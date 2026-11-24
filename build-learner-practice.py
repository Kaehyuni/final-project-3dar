"""Draft and verify additional BioBridge practice records without network access."""

import argparse
import gzip
import io
import json
import random
import unicodedata
import zipfile
from collections import Counter, defaultdict
from contextlib import nullcontext
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parents[1]
from draft_practice import BIO_FAMILIES, CHEM_FAMILIES, bio1, bio2, chemistry
from learner_practice_support import canonical, independent_math, make_practice, validate

SEED = 202611242
PRIOR = WORKSPACE / 'outputs' / 'BridgeAssist-Drafts' / 'BridgeAssist-Drafts.zip'
OUTPUT = WORKSPACE / 'outputs' / 'BridgeAssist-Expanded-Practice'
COURSES = (*BIO_FAMILIES, *CHEM_FAMILIES)
LIMITED = {
    'glycolysis-budget': 2600,
    'citric-carbon-carriers': 4800,
    'meiosis-sample': 4800,
    'inheritance-two-loci': 1800,
    'calvin-resources': 1100,
    'hardy-recessive': 4500,
    'mass-to-particles': 800,
    'empirical-formula': 1000,
}
UNORDERED = {
    'glycolysis-budget': ('glucose in A', 'glucose in B'),
    'calvin-resources': ('net G3P in first diagram', 'net G3P in second diagram'),
}
PLAIN_START = {
    'mitotic-index': 'Start by finding the fraction of cells in mitosis in each field. For the pooled fraction, add the two mitotic counts and divide by the combined cell count.',
    'enzyme-data': 'Find how much product each sample makes in one second. Comparing product alone can hide the fact that one sample ran longer.',
    'glycolysis-budget': 'Add the glucose molecules first. For each one, glycolysis makes four ATP and spends two, so the net gain is two ATP.',
    'citric-carbon-carriers': 'Count how many acetyl-CoA molecules enter the cycle. Each acetyl-CoA runs through one turn. Use the amount made in one turn for each output.',
    'meiosis-sample': 'One set of chromosomes goes to each cell in meiosis I. Count the chromosomes in that set and remember that each still has two attached chromatids.',
    'inheritance-two-loci': 'Find the chance of the requested allele combination at each gene. Multiply for one offspring, then use the chance of no matches to work out at least one match.',
    'membrane-model': 'Compare the two starting solute concentrations to see which way water moves. The solute stays in the bag, so use its fixed amount to find the final volume.',
    'calvin-resources': 'Add the G3P molecules that leave both diagrams. Then use the number of CO₂, ATP, and NADPH molecules needed per G3P that leaves.',
    'allele-counting': 'Count copies of A out of all allele copies. For the observed Aa frequency, count Aa individuals out of all individuals.',
    'ecosystem-energy': 'Subtract the energy producers use in respiration. Apply one transfer percentage at a time to the energy available at that step.',
    'logistic-compare': 'For each population, find how much the carrying capacity slows growth. Multiply the growth per individual by the number of individuals to get total growth.',
    'demographic-balance': 'Add births and arrivals. Subtract deaths and departures. Compare the net change with the original population to find the percent change.',
    'hardy-recessive': 'The recessive phenotype gives q² under the stated model. Take its square root to get q. Use p = 1 − q to find the other allele frequency.',
    'mark-recapture': 'Use the fraction of marked individuals in the second sample. The estimate assumes that fraction is close to the marked fraction in the whole population.',
    'mass-to-particles': 'Use molar mass to change grams into moles. Then multiply by the number of particles per mole. Each step should cancel the unit you started with.',
    'displacement-density': 'Subtract the two water levels to get the sample’s volume. Divide the sample mass by that volume.',
    'solution-mass': 'Convert the solution volume to liters, then use the concentration to find moles of solute. Multiply by the molar mass to find grams.',
    'dilution-aliquot': 'Find how much solute the final solution needs. Divide that amount by the stock concentration to find how much stock to take.',
    'isotope-mixture': 'Find the missing percentage first. Then multiply each isotope mass by its share and add the two contributions.',
    'empirical-formula': 'Turn each element’s mass into moles. Compare the mole amounts by dividing by the smallest one. Find the simplest whole-number ratio.',
    'gas-compare': 'The same temperature change affects pressure when volume stays fixed, and volume when pressure stays fixed. Use kelvin in both ratios.',
    'heat-and-state': 'Find the temperature change first. Multiply by the sample mass and specific heat. Check whether the sample gained or lost heat.',
    'hess-path': 'Turn the given reactions so the target reactant and product are on the right sides. Reverse the sign of the heat change each time you reverse a reaction.',
    'reaction-yield': 'Use the balanced equation to find how much product each reactant could make. The smaller amount sets the theoretical yield.',
}
CHAT_FIELDS = (
    'id', 'record_kind', 'primary_collection', 'courses', 'topic', 'family_id', 'question',
    'source_ids', 'first_tutoring_reply', 'diagnostic_question', 'progressive_hints',
    'reference_answer', 'worked_solution', 'methods', 'provenance', 'word_problem_breakdown',
    'unit_chain', 'assumptions', 'rounding_explanation', 'answer_unit', 'reported_value',
    'unit_explanation', 'review_status',
)
QUESTION_TRANSLATION = str.maketrans({"‘": "'", "’": "'", "‐": "-", "‑": "-", "–": "-", "−": "-"})


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')


def search_key(question):
    normalized = unicodedata.normalize('NFKC', question).translate(QUESTION_TRANSLATION).lower()
    return ' '.join(normalized.split()).rstrip('?!.')


def index_bucket(key):
    # Match the library client's FNV-1a over UTF-16 code units.
    value = 0x811c9dc5
    data = key.encode('utf-16-le')
    for offset in range(0, len(data), 2):
        value = ((value ^ (data[offset] | (data[offset + 1] << 8))) * 0x01000193) & 0xffffffff
    return f'{value >> 24:02x}'


class PracticeIndex:
    shard_size = 128

    def __init__(self, publish_path):
        self.destination = publish_path / 'data' / 'bridgeassist-expanded' / 'v1'
        for folder in ('records', 'catalog', 'families', 'exact'):
            (self.destination / folder).mkdir(parents=True, exist_ok=True)
        self.position = 0
        self.collections = []
        self.records = []
        self.catalog = []
        self.by_family = defaultdict(list)
        self.exact = defaultdict(dict)

    def compressed(self, path, data):
        (self.destination / (path + '.bin')).write_bytes(gzip.compress(json_bytes(data), compresslevel=4, mtime=0))

    def flush(self):
        if not self.records:
            return
        index = (self.position - 1) // self.shard_size
        self.compressed(f'records/{index}', self.records)
        self.compressed(f'catalog/{index}', self.catalog)
        self.records.clear()
        self.catalog.clear()

    def add(self, record):
        position = self.position
        family = record['family_id']
        self.records.append({key: record[key] for key in CHAT_FIELDS})
        self.catalog.append([record['id'], 'practice', len(self.collections),
                             record['topic'], record['question'], family])
        self.by_family[family].append(position)
        key = search_key(record['question'])
        bucket = self.exact[index_bucket(key)]
        earlier = bucket.get(key)
        if earlier is None:
            bucket[key] = position
        elif isinstance(earlier, list):
            earlier.append(position)
        else:
            bucket[key] = [earlier, position]
        self.position += 1
        if len(self.records) == self.shard_size:
            self.flush()

    def finish_course(self, course, slug, count):
        families = []
        for family, positions in self.by_family.items():
            file = f'families/{slug}-{family}'
            self.compressed(file, positions)
            families.append({'id': family, 'count': len(positions), 'file': file + '.bin'})
        self.collections.append({'course': course, 'slug': slug, 'start': self.position - count,
                                 'end': self.position, 'practice': count, 'families': families})
        self.by_family.clear()

    def finish(self, sources):
        self.flush()
        for number in range(256):
            bucket = f'{number:02x}'
            self.compressed(f'exact/{bucket}', self.exact.get(bucket, {}))
        manifest = {'total': self.position, 'shardSize': self.shard_size,
                    'collections': self.collections, 'sources': len(sources), 'status': 'draft'}
        (self.destination / 'sources.json').write_bytes(json_bytes(sources))
        (self.destination / 'manifest.json').write_bytes(json_bytes(manifest))


def read_zip(path):
    with zipfile.ZipFile(path) as archive:
        yield json.loads(archive.read('sources.json'))
        for name in archive.namelist():
            if name.endswith('.jsonl'):
                with archive.open(name) as stream:
                    yield from map(json.loads, io.TextIOWrapper(stream, encoding='utf-8'))


def read_repo(folder):
    descriptor = json.loads((folder / 'bridgeassist-inputs.json').read_text(encoding='utf-8-sig'))
    yield json.loads((folder / descriptor['sources']['file']).read_bytes())
    for row in descriptor['files']:
        data = b''.join((folder / part).read_bytes() for part in row.get('parts', [row['file']]))
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
            yield from map(json.loads, io.TextIOWrapper(stream, encoding='utf-8'))


def symmetric_key(family, givens):
    names = UNORDERED.get(family)
    if names and all(name in givens for name in names):
        return (family, *sorted(int(givens[name]) for name in names))
    return None


def build_practice(prior, output, per_course, publish=None):
    sources = next(prior)
    by_url = {source['url']: key for key, source in sources.items()}
    seen = set()
    symmetric = set()
    for row in prior:
        key = canonical(row['question'])
        assert key not in seen, row['id']
        seen.add(key)
        given = {part['label']: part['value'] for part in row.get('provenance', ())
                 if part['id'].startswith('given-') and 'value' in part}
        key = symmetric_key(row.get('family_id'), given)
        if key:
            symmetric.add(key)
    assert len(seen) == 150000, len(seen)
    original_count = len(seen)

    rng = random.Random(SEED)
    used_sources = set()
    counts = {}
    shards = PracticeIndex(publish) if publish else None
    if shards is None:
        output.mkdir(parents=True, exist_ok=True)
    archive_path = output / 'BridgeAssist-Expanded-Practice.zip'
    partial = output / 'BridgeAssist-Expanded-Practice.partial.zip'
    writer_context = nullcontext() if shards else zipfile.ZipFile(partial, 'w', zipfile.ZIP_DEFLATED, compresslevel=3)
    with writer_context as archive:
        for course in COURSES:
            slug = course.lower().replace(' ', '-')
            families = BIO_FAMILIES.get(course) or CHEM_FAMILIES[course]
            maker = bio1 if course == 'BIOL 1406' else bio2 if course == 'BIOL 1407' else chemistry
            total = 0
            attempts = 0
            counts[course] = Counter()
            row_context = archive.open(slug + '.jsonl', 'w', force_zip64=True) if archive else nullcontext()
            with row_context as writer:
                while total < per_course:
                    family = families[attempts % len(families)]
                    attempts += 1
                    if attempts > max(1000, per_course * 40):
                        raise RuntimeError(f'Not enough distinct examples for {course}: {total}/{per_course}')
                    if counts[course][family] >= LIMITED.get(family, per_course):
                        continue
                    problem = maker(family, rng, attempts)
                    key = canonical(problem['question'])
                    equivalent = symmetric_key(family, {label: value for label, value, _ in problem['given']})
                    if key in seen or (equivalent and equivalent in symmetric):
                        continue
                    problem['reasoning'] = PLAIN_START[family]
                    record = make_practice(course, f'expanded-{slug}-P-{total + 1:05}', family, problem, by_url.__getitem__)
                    validate(record, sources)
                    try:
                        independent_math(record)
                    except Exception as error:
                        raise AssertionError((record['id'], family, record['reference_answer'])) from error
                    if shards:
                        shards.add(record)
                    else:
                        writer.write(json_bytes(record))
                    used_sources.update(record['source_ids'])
                    seen.add(key)
                    if equivalent:
                        symmetric.add(equivalent)
                    counts[course][family] += 1
                    total += 1
            if shards:
                shards.finish_course(course, slug, total)
            print(f'{course}: {total:,} original problems independently recomputed.', flush=True)
        total = len(seen) - original_count
        assert total == per_course * len(COURSES)
        report = {
            'new_practice_problems': total,
            'prior_records_checked_for_duplicates': original_count,
            'per_course': {course: sum(families.values()) for course, families in counts.items()},
            'families_by_course': counts,
            'independently_recomputed': total,
            'existing_problems_repeated': 0,
            'sources': len(used_sources),
            'individual_editorial_review': 'pending',
            'practice_origin': 'Original parameterized classroom problems with new givens',
            'seed': SEED,
        }
        references = {key: sources[key] for key in sorted(used_sources)}
        if shards:
            shards.finish(references)
            (shards.destination / 'validation.json').write_bytes(json_bytes(report))
            print(f'{total:,} worked practice problems assembled under {shards.destination}.', flush=True)
            return
        archive.writestr('manifest.json', json_bytes(report))
        archive.writestr('sources.json', json_bytes(references))
    with zipfile.ZipFile(partial) as archive:
        assert archive.testzip() is None, 'Archive CRC check failed'
    partial.replace(archive_path)
    (output / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(f'{total:,} worked practice problems: {archive_path} ({archive_path.stat().st_size:,} bytes).', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prior', type=Path, default=PRIOR, help='Existing corpus ZIP or folder of Git deployment archives')
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--publish', type=Path, help='Static site root for searchable gzip records')
    parser.add_argument('--per-course', type=int, default=60_000)
    args = parser.parse_args()
    if args.per_course < 1:
        parser.error('--per-course must be positive')
    prior_rows = read_repo(args.prior) if args.prior.is_dir() else read_zip(args.prior)
    build_practice(prior_rows, args.output, args.per_course, args.publish)

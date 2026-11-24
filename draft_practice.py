"""Deterministic classroom problems with reproducible givens and worked solvers."""
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction

B = 'https://openstax.org/books/biology-2e/pages/'
C = 'https://openstax.org/books/chemistry-2e/pages/'

def fmt(x):
    if isinstance(x, Fraction) and x.denominator != 1:
        return f'{x.numerator}/{x.denominator}'
    return str(int(x))

def D(value):
    return Decimal(str(value))

def sig(value, digits):
    value = Decimal(value)
    if not value:
        return '0'
    rounded = value.quantize(Decimal(1).scaleb(value.adjusted() - digits + 1), rounding=ROUND_HALF_EVEN)
    if rounded.as_tuple().exponent > 0 or (rounded.adjusted() >= digits - 1 and rounded == rounded.to_integral() and rounded % 10 == 0):
        return f'{rounded:.{digits-1}E}'
    return format(rounded, 'f')

def exercise(question, given, target, method, reasoning, steps, answer, url, *, assumptions='', alternate='', factors=(), precision='', target_unit='', result=None):
    return dict(question=question, given=given, target=target, method=method, reasoning=reasoning,
        steps=steps, answer=answer, url=url, assumptions=assumptions, alternate=alternate,
        factors=factors, precision=precision, target_unit=target_unit, result=result)

def bio1(family, rng, index):
    if family == 'mitotic-index':
        a,b,c,d=(rng.randint(15,190) for _ in range(4))
        ma,mb = rng.randint(2,a//3),rng.randint(2,c//3)
        n1,n2=a+b,c+d
        pooled=(ma+mb)/(n1+n2)
        return exercise(f'An archived cell-image dataset contains {n1} cells in field A, including {ma} in mitosis. Field B has {n2} cells, including {mb} in mitosis. Find both mitotic indices and the pooled index. Can these counts establish how long an individual cell spent in mitosis?',
            [('field A total',str(n1),'cells'),('field A mitotic',str(ma),'cells'),('field B total',str(n2),'cells'),('field B mitotic',str(mb),'cells')],
            'field and pooled mitotic indices','count fractions from image data','A mitotic index counts cells classified in mitosis divided by the total counted.',
            [f'A: {ma}/{n1} × 100 = {100*ma/n1:.2f}%.',f'B: {mb}/{n2} × 100 = {100*mb/n2:.2f}%.',
             f'Pooled: ({ma}+{mb})/({n1}+{n2}) × 100 = {100*pooled:.2f}%.',
             'A snapshot is a count rather than a direct duration measurement. Inferring time requires additional assumptions about sampling and cell-cycle dynamics.'],
            f'A {100*ma/n1:.2f}%, B {100*mb/n2:.2f}%, pooled {100*pooled:.2f}%. Individual duration is undetermined.',B+'10-2-the-cell-cycle',
            alternate='Weight each field fraction by the number of cells counted in that field, then divide by the combined count.')
    if family == 'enzyme-data':
        ta,tb=rng.sample(range(3,71),2)
        pa,pb=rng.sample(range(5,200),2)
        ra,rb=Fraction(pa,ta),Fraction(pb,tb)
        comparison='A' if ra>rb else ('B' if rb>ra else 'neither')
        return exercise(f'An enzyme activity graph shows sample A generating {pa} teaching units of product in {ta} s and sample B generating {pb} units in {tb} s. Both plotted intervals are approximately linear. Compare the slopes and explain why product totals alone can be misleading.',
            [('product in A',str(pa),'units'),('A interval',str(ta),'s'),('product in B',str(pb),'units'),('B interval',str(tb),'s')],
            'two rates and faster sample','compare product formation per second','Different time intervals require comparison on a shared time basis.',
            [f'A slope: {pa}/{ta} = {float(ra):.4f} units/s.',f'B slope: {pb}/{tb} = {float(rb):.4f} units/s.',
             'A higher product total could reflect a longer time window. Compare slopes for this dataset.'],
            f'A {float(ra):.4f} units/s and B {float(rb):.4f} units/s. Faster sample: {comparison}.',B+'6-5-enzymes',
            alternate='Scale both product totals to the same duration and compare those projected totals within the linear model.')
    if family == 'glycolysis-budget':
        a, b = rng.sample(range(3, 100), 2)
        total = (a+b)*2
        return exercise(f'Two classroom diagrams track {a} and {b} glucose molecules completing glycolysis. How many ATP are produced gross and how many are gained net across both diagrams?', 
            [('glucose in A',str(a),'molecules'),('glucose in B',str(b),'molecules'),('gross ATP per glucose','4','ATP/glucose'),('ATP investment','2','ATP/glucose')],
            'gross and net ATP counts', 'ATP accounting', 'A net yield deducts the ATP invested. Use one glucose as the accounting basis.',
            [f'The diagrams track {a} + {b} = {a+b} glucose molecules.',f'Gross production is 4 × {a+b} = {2*total} ATP. The investment is 2 × {a+b} = {total} ATP.',f'Subtract the investment to obtain {total} net ATP.'],
            f'{2*total} gross ATP and {total} net ATP.',B+'7-2-glycolysis',assumptions='Only glycolysis is counted.',alternate=f'Compute 4g gross and (4 − 2)g net for each diagram separately, then add the two totals.')
    if family == 'citric-carbon-carriers':
        g, a = rng.sample(range(2, 90), 2)
        turns = 2*g+a
        return exercise(f'A pathway diagram sends the acetyl-CoA derived from {g} glucose molecules and {a} additional acetyl-CoA molecules into the citric acid cycle. Count CO₂ and NADH produced by the cycle itself.',
            [('glucose molecules',str(g),'molecules'),('additional acetyl-CoA',str(a),'molecules')],
            'cycle CO₂ and NADH', 'per-turn output accounting', 'Each acetyl-CoA contributes one turn. Starting from one fully processed glucose supplies two acetyl-CoA.',
            [f'Acetyl-CoA available = 2 × {g} + {a} = {turns}.',f'Each turn produces 2 CO₂ and 3 NADH.',f'Multiply each per-turn count by {turns}.'],
            f'{2*turns} CO₂ and {3*turns} NADH.',B+'7-3-oxidation-of-pyruvate-and-the-citric-acid-cycle',
            assumptions='All the specified glucose has been processed to acetyl-CoA. Count only the cycle.',alternate='Calculate the outputs from each input stream separately and sum matching outputs.')
    if family == 'meiosis-sample':
        n, cells = rng.randint(2, 90),rng.randint(3, 95)
        return exercise(f'A simplified species has 2n = {2*n}. A microscope diagram contains {cells} cells that have finished meiosis I. How many chromosome sets per cell and how many sister chromatids across those cells?',
            [('diploid chromosome number',str(2*n),'chromosomes'),('cells pictured',str(cells),'cells')],
            'ploidy per cell and total chromatids', 'separate chromosome sets from DNA copies', 'Meiosis I separates homologs. Each remaining chromosome is still replicated.',
            [f'One chromosome set contains {2*n} ÷ 2 = {n} chromosomes.',f'Each of those {n} chromosomes has two chromatids, or {2*n} chromatids per cell.',f'Total = {cells} × {2*n} = {cells*2*n} chromatids.'],
            f'One set (haploid) per cell and {cells*2*n} sister chromatids in the sample.',B+'11-1-the-process-of-meiosis',
            assumptions='Normal segregation. The cells are observed after meiosis I and before sister separation.',alternate='Make a two-column tally for chromosomes and chromatids. Multiply the chromatid column by the sample size.')
    if family == 'inheritance-two-loci':
        cross = ['AA','Aa','aa']
        p1,p2,p3,p4 = (rng.choice(cross) for _ in range(4))
        target1,target2 = rng.choice(cross),rng.choice(cross)
        target2 = target2.replace('A','B').replace('a','b')
        b1,b2 = (g.replace('A','B').replace('a','b') for g in (p3,p4))
        parent1,parent2=sorted((p1+b1,p2+b2))
        p1,b1=parent1[:2],parent1[2:]
        p2,b2=parent2[:2],parent2[2:]
        combinations_a = [''.join(sorted(x+y)) for x in p1 for y in p2]
        combinations_b = [''.join(sorted(x+y)) for x in b1 for y in b2]
        pa,pb = Fraction(combinations_a.count(target1),4), Fraction(combinations_b.count(target2),4)
        result=pa*pb
        births=rng.randint(1,12)
        at_least_one=1-(1-result)**births
        return exercise(f'For the cross {p1}{b1} × {p2}{b2}, what is the probability at least one of {births} independent offspring has genotype {target1}{target2}? Assume independent assortment.',
            [('parent 1',p1+b1,''),('parent 2',p2+b2,''),('target',target1+target2,''),('number of offspring',str(births),'individuals')],
            f'probability of at least one {target1}{target2}', 'independent joint probability and complement', 'Find each locus outcome first. Independent assortment permits multiplication of their probabilities.',
            [f'At the A locus, four equally weighted pairings give {", ".join(combinations_a)}. P({target1}) = {fmt(pa)}.',
             f'At the B locus, the pairings give {", ".join(combinations_b)}. P({target2}) = {fmt(pb)}.',
             f'For one offspring the joint probability is {fmt(pa)} × {fmt(pb)} = {fmt(result)}.',
             f'Compute the complement of no matches: 1 − (1 − {fmt(result)})^{births} ≈ {float(at_least_one):.6f}.'],
            f'Probability ≈ {float(at_least_one):.6f} (exact fraction {fmt(at_least_one)}).',B+'12-3-laws-of-inheritance',
            assumptions='Ordinary Mendelian segregation at two independent autosomal loci and independent offspring.',
            alternate='Count the two-locus gamete outcomes for one offspring, then subtract the probability all attempts fail from 1.')
    if family == 'membrane-model':
        inside, outside, start = rng.sample(range(10, 98), 3)
        a,b = 10*inside,10*outside
        # Water direction only. The starting volume is needed for the separate expected-volume task.
        ratio = Fraction(a,b)
        direction = 'into' if a>b else 'out of'
        new = ratio*start
        return exercise(f'An idealized flexible membrane bag has volume {start} mL and {a} mmol/L of trapped solute. It is placed in a large bath held at {b} mmol/L of the same impermeant solute. Predict initial net water direction and the bag volume when concentrations match.',
            [('starting volume',str(start),'mL'),('inside concentration',str(a),'mmol/L'),('bath concentration',str(b),'mmol/L')],
            'water direction and idealized final volume', 'osmosis and conservation of trapped solute',
            'Water can cross, while solute stays trapped. Compare effective concentrations, then keep solute amount fixed.',
            [f'Initially the effective solute concentration is higher {"inside" if a>b else "outside"}, so net water moves {direction} the bag.',
             f'Set ({a} mmol/L)({start} mL) = ({b} mmol/L)V_final.',
             f'Solve V_final = {start} mL × {a}/{b} = {float(new):.4g} mL.'],
            f'Net water moves {direction} the bag. The model volume is about {float(new):.4g} mL.',B+'5-2-passive-transport',
            assumptions='Ideal dilute solution, pressure difference ignored, fixed bath, no rupture and no solute permeation.',
            alternate='Convert the initial bag volume to liters and calculate its trapped millimoles. Divide by the bath concentration, then convert back to mL.',
            factors=[factor(quantity(start,'mL')),factor(quantity(a,'mmol/L','concentration'),quantity(b,'mmol/L','concentration'))])
    if family == 'calvin-resources':
        first, second = rng.sample(range(2, 80),2)
        turns=first+second
        return exercise(f'Two diagrams show {first} and {second} net G3P molecules leaving the Calvin cycle. How many CO₂, ATP and NADPH are required altogether in the standard net bookkeeping?',
            [('net G3P in first diagram',str(first),'molecules'),('net G3P in second diagram',str(second),'molecules')],
            'total CO₂, ATP and NADPH', 'Calvin cycle input–output accounting',
            'Use the standard net input per one G3P that exits. The other G3P in the cycle contributes to regeneration.',
            [f'Total exported G3P = {first}+{second} = {turns}.','Multiply each exported G3P by 3 CO₂, 9 ATP and 6 NADPH.',f'{turns} × 3 = {3*turns}; {turns} × 9 = {9*turns}; {turns} × 6 = {6*turns}.'],
            f'{3*turns} CO₂, {9*turns} ATP and {6*turns} NADPH.',B+'8-3-using-light-energy-to-make-organic-molecules',
            alternate='Sum each diagram’s consumption separately using the same stoichiometric basis.')
    raise ValueError(family)

def bio2(family, rng, index):
    a,b,c = rng.sample(range(11, 140),3)
    if family == 'allele-counting':
        total = a+b+c
        p = Fraction(2*a+b, 2*total)
        observed = Fraction(b,total)
        expected = 2*p*(1-p)
        return exercise(f'A sample contains {a} AA, {b} Aa and {c} aa individuals. Compute A allele frequency and compare observed heterozygosity with its Hardy–Weinberg prediction.',
            [('AA',str(a),'individuals'),('Aa',str(b),'individuals'),('aa',str(c),'individuals')],
            'allele frequency and two heterozygote frequencies', 'direct tally then equilibrium comparison',
            'Allele frequency counts copies. Observed heterozygosity counts individuals. The model prediction is a separate calculation.',
            [f'Count {2*a+b} A copies among {2*total} allele copies, giving p = {fmt(p)}.',f'Observed Aa frequency = {b}/{total} ≈ {float(observed):.4f}.',
             f'The prediction 2p(1 − p) ≈ {float(expected):.4f}. A difference alone does not establish a cause.'],
            f'p ≈ {float(p):.4f}, observed ≈ {float(observed):.4f}, predicted ≈ {float(expected):.4f}.',B+'19-1-population-evolution',
            alternate='Find p from AA frequency plus half the Aa frequency. Use the ordered outcomes Aa and aA for the model prediction.')
    if family == 'ecosystem-energy':
        gross, respiration = 100*(a+b),100*b
        e1,e2 = rng.sample(range(6, 26),2)
        net=gross-respiration
        second=Fraction(net*e1*e2,10000)
        return exercise(f'One ecosystem model gives gross primary production {gross} kJ/m²/year and producer respiration {respiration} kJ/m²/year. Transfer is {e1}% to primary consumers and {e2}% from them to secondary consumers. Find net primary production and estimated secondary-consumer production.',
            [('gross production',str(gross),'kJ/m²/year'),('respiration',str(respiration),'kJ/m²/year'),('first transfer',str(e1),'%'),('second transfer',str(e2),'%')],
            'net primary production and secondary production','energy budget and transfer efficiencies','Start from available net production. Each successive transfer uses its own given fraction.',
            [f'NPP = {gross} − {respiration} = {net} kJ/m²/year.',f'Primary consumers: {net} × {e1}/100 = {net*e1/100:g} kJ/m²/year.',
             f'Secondary consumers: {net} × {e1}/100 × {e2}/100 = {float(second):g} kJ/m²/year.'],
            f'NPP = {net} kJ/m²/year. Secondary production ≈ {float(second):g} kJ/m²/year.',B+'46-2-energy-flow-through-ecosystems',
            alternate='Multiply the two transfer fractions to get the total producer-to-secondary transfer, then apply it to NPP.')
    if family == 'logistic-compare':
        n1,n2=sorted([a,b])
        k=n1+n2+c
        rate=Fraction(rng.randint(5,59),100)
        r1,r2=(rate*n*(1-Fraction(n,k)) for n in (n1,n2))
        return exercise(f'Two populations follow dN/dt = rN(1 − N/K) with the same r = {float(rate):.2f} per year and K = {k}. Current sizes are {n1} and {n2}. Compare per-capita and total growth rates.',
            [('first N',str(n1),'individuals'),('second N',str(n2),'individuals'),('K',str(k),'individuals'),('r',f'{float(rate):.2f}','1/year')],
            'two per-capita rates and two total rates','evaluate the logistic model twice',
            'The density factor reduces the per-capita rate. Total growth adds a multiplication by population size.',
            [f'The density factors are 1 − {n1}/{k} and 1 − {n2}/{k}.',f'Per-capita rates are {float(r1/n1):.4f} and {float(r2/n2):.4f} per year.',
             f'Multiply each by its own N for {float(r1):.3f} and {float(r2):.3f} individuals/year.'],
            f'The smaller population grows faster per capita. Total rates are {float(r1):.3f} and {float(r2):.3f} individuals/year, respectively.',
            B+'45-3-environmental-limits-to-population-growth',alternate='Compute unrestricted growth rN then subtract rN²/K for each population.')
    if family == 'demographic-balance':
        initial=6*(a+b+c)
        migration_in,migration_out=rng.sample(range(3,61),2)
        births,deaths=a,b
        net=births-deaths+migration_in-migration_out
        return exercise(f'A survey starts with {initial} individuals. During the same interval, {births} are born, {deaths} die, {migration_in} arrive and {migration_out} leave. Calculate final population and percent change from the starting census.',
            [('initial',str(initial),'individuals'),('births',str(births),'individuals'),('deaths',str(deaths),'individuals'),('immigration',str(migration_in),'individuals'),('emigration',str(migration_out),'individuals')],
            'final count and signed percentage change','population balance','Births and immigration add individuals. Deaths and emigration remove them.',
            [f'Net change = {births} − {deaths} + {migration_in} − {migration_out} = {net}.',f'Final census = {initial} + ({net}) = {initial+net}.',
             f'Percent change = {net}/{initial} × 100% ≈ {100*net/initial:.2f}%.'],
            f'{initial+net} individuals and a {100*net/initial:+.2f}% change.',B+'45-1-population-demography',
            alternate='Compute final census from entries and exits, then subtract the original census before dividing by it.')
    if family == 'hardy-recessive':
        q=Fraction(rng.randint(5,65),100)
        p=1-q
        size=10000*rng.randint(1,120)
        return exercise(f'A hypothetical population of {size:,} diploid individuals fits a two-allele Hardy–Weinberg model. A fully recessive phenotype occurs in {float(q*q)*100:.2f}% of individuals. Estimate numbers of heterozygotes and dominant homozygotes.',
            [('population size',str(size),'individuals'),('recessive phenotype',f'{float(q*q)*100:.2f}','%')],
            'predicted Aa and AA counts','Hardy–Weinberg genotype expectations',
            'The recessive proportion gives q² under the stated phenotype and equilibrium assumptions.',
            [f'q = √{float(q*q):.4f} = {float(q):.2f}. Then p = 1 − q = {float(p):.2f}.',
             f'Heterozygote fraction = 2pq = {float(2*p*q):.4f}. Homozygous dominant fraction = p² = {float(p*p):.4f}.',
             f'Multiply each predicted fraction by {size:,}.'],
            f'{int(size*2*p*q):,} predicted heterozygotes and {int(size*p*p):,} predicted dominant homozygotes.',B+'19-1-population-evolution',
            alternate='Use a gamete probability grid with p and q and add its two heterozygote cells.')
    if family == 'mark-recapture':
        tagged, second = a,b
        marked=rng.randint(2,min(tagged,second)-1)
        estimate=Fraction(tagged*second,marked)
        return exercise(f'A study marks {tagged} animals. A later sample has {second} animals, of which {marked} are marked. Estimate population size with the simple Lincoln–Petersen model and name a condition needed for the estimate.',
            [('initial marked count',str(tagged),'individuals'),('second sample',str(second),'individuals'),('marked recaptures',str(marked),'individuals')],
            'estimated total population and model assumption','capture–recapture proportion',
            'Approximate the marked fraction in the whole population by the marked fraction in the second sample.',
            [f'Write {tagged}/N ≈ {marked}/{second}.',f'Solve N ≈ {tagged} × {second}/{marked} = {float(estimate):.3f}.',
             'Assumptions include a closed population, adequate mixing, retained marks and similar capture probabilities.'],
            f'About {int(estimate+Fraction(1,2))} individuals, assuming the capture–recapture model applies.',B+'45-1-population-demography',
            alternate='Divide the known number marked by the observed marked fraction.')
    raise ValueError(family)

BIO_FAMILIES = {
    'BIOL 1406': ('glycolysis-budget','citric-carbon-carriers','meiosis-sample','inheritance-two-loci','membrane-model','calvin-resources','mitotic-index','enzyme-data'),
    'BIOL 1407': ('allele-counting','ecosystem-energy','logistic-compare','demographic-balance','hardy-recessive','mark-recapture'),
}

NA = 'https://www.nist.gov/pml/owm/si-units-amount-substance'
GAS = C+'9-2-relating-pressure-volume-amount-and-temperature-the-ideal-gas-law'
HEAT = C+'5-2-calorimetry'
UNITS = C+'1-6-mathematical-treatment-of-measurement-results'
MOLE = C+'3-1-formula-mass-and-the-mole-concept'
SOLUTION = C+'3-3-molarity'
SIGFIG = C+'1-5-measurement-uncertainty-accuracy-and-precision'

def quantity(value, label, cancel=None):
    return {'value':str(value),'units':[{'text':label,'cancel':cancel}]}

def factor(top, bottom=None):
    return {'top':top,'bottom':bottom}

def chemistry(family, rng, index):
    # Measured inputs are displayed with three significant figures. Integer
    # teaching counts and conversion factors carry their stated exactness.
    a,b,c = (D(rng.randint(101,999))/100 for _ in range(3))
    if family=='mass-to-particles':
        formula, mass = rng.choice([('H₂O','18.02'),('NaCl','58.44'),('CO₂','44.01'),('O₂','32.00'),('N₂','28.02'),('CH₄','16.04')])
        entity='formula units' if formula=='NaCl' else 'molecules'
        moles=a/D(mass); particles=moles*D('6.02214076e23')
        chain=[factor(quantity(sig(a,3),'g','mass')),factor(quantity('1','mol','amount'),quantity(mass,'g','mass')),factor(quantity('6.02214076 × 10²³',entity),quantity('1','mol','amount'))]
        return exercise(f'A {sig(a,3)} g sample of {formula} has supplied molar mass {mass} g/mol. Determine its amount in moles and number of {entity}.',
            [('sample mass',sig(a,3),'g'),('supplied molar mass',mass,'g/mol'),('Avogadro constant','6.02214076 × 10²³','entities/mol')],
            'amount and specified particle count','mass → amount → entities','Molar mass links grams with moles. The Avogadro constant links moles with the stated entities.',
            [f'n = {sig(a,3)} g ÷ {mass} g/mol ≈ {moles:.8g} mol.',f'N = n × 6.02214076 × 10²³ {entity}/mol ≈ {particles:.8E} {entity}.','Round both reported results from the unrounded amounts.'],
            f'{sig(moles,3)} mol and {sig(particles,3)} {entity}.',MOLE,alternate='First calculate the number of entities per gram by dividing the Avogadro constant by the molar mass, then multiply by sample mass.',
            factors=chain,precision='Sample mass has three significant figures. The supplied molar mass has four and the Avogadro constant is exact.',target_unit=entity,result=sig(particles,3))
    if family=='displacement-density':
        initial=D(rng.randint(120,299))/10
        displaced=D(rng.randint(22,148))/10
        final=initial+displaced
        mass=a*10
        density=mass/displaced
        digits=min(3,len(D(f'{displaced:.1f}').as_tuple().digits))
        return exercise(f'A solid has a measured mass of {sig(mass,3)} g. A cylinder reads {initial:.1f} mL before immersion and {final:.1f} mL afterward. Find the solid volume and density.',
            [('sample mass',sig(mass,3),'g'),('initial water level',f'{initial:.1f}','mL'),('final water level',f'{final:.1f}','mL')],
            'volume and mass per volume','water displacement then density','The change in the water reading measures the submerged solid volume.',
            [f'Volume = {final:.1f} − {initial:.1f} = {displaced:.1f} mL.',f'ρ = {sig(mass,3)} g ÷ {displaced:.1f} mL ≈ {density:.8g} g/mL.',f'Report the density to {digits} significant figures.'],
            f'Volume = {displaced:.1f} mL and density = {sig(density,digits)} g/mL.',SIGFIG,assumptions='The solid is fully immersed and does not dissolve or trap air.',
            alternate='First read both cylinder marks as cubic centimeters using 1 mL = 1 cm³. Their difference has the same numerical value.',
            factors=[factor(quantity(sig(mass,3),'g'),quantity(f'{displaced:.1f}','mL'))],precision='Apply the decimal-place rule to the subtraction, then the significant-figure rule to division.')
    if family=='solution-mass':
        formula, mm = rng.choice([('NaCl','58.44'),('KCl','74.55'),('sucrose','342.30'),('glucose','180.16')])
        m=a/10; vol=b*100; moles=m*vol/1000; mass=moles*D(mm)
        return exercise(f'A classroom calculation specifies {sig(vol,3)} mL of final {formula} solution at {sig(m,3)} mol/L. With molar mass {mm} g/mol, how many grams of solute are present?',
            [('final solution volume',sig(vol,3),'mL'),('molarity',sig(m,3),'mol/L'),('supplied molar mass',mm,'g/mol')],
            'solute mass','solution volume → solute amount → mass','Concentration relates solute moles to final solution volume. The question asks for mass, so convert the amount using molar mass.',
            [f'V = {sig(vol,3)} mL ÷ 1000 = {vol/1000:f} L.',f'n = MV = {moles:f} mol.',f'm = n × {mm} g/mol = {mass:f} g before rounding.'],
            f'{sig(mass,3)} g {formula}.',SOLUTION,alternate='Convert molarity to grams per liter with the given molar mass first, then multiply by liters.',
            factors=[factor(quantity(sig(vol,3),'mL','volume-ml')),factor(quantity('1','L','volume-l'),quantity('1000','mL','volume-ml')),factor(quantity(sig(m,3),'mol','amount'),quantity('1','L','volume-l')),factor(quantity(mm,'g'),quantity('1','mol','amount'))],
            precision='The solution volume and molarity are given to three significant figures. The metric conversion is exact.',target_unit='g',result=sig(mass,3))
    if family=='dilution-aliquot':
        stock=a; target=stock/10
        final=b*100
        n=target*final/1000
        aliquot=final/10
        # Format the concentrations so displayed values and calculations agree.
        return exercise(f'Prepare a theoretical final volume of {sig(final,3)} mL at {sig(target,3)} mol/L from a {sig(stock,3)} mol/L stock of the same solute. Find the stock aliquot in mL and moles of solute in that aliquot.',
            [('final volume',sig(final,3),'mL'),('target molarity',sig(target,3),'mol/L'),('stock molarity',sig(stock,3),'mol/L')],
            'stock volume and conserved solute amount','conservation of solute','Dilution changes solution volume while preserving the amount of the solute transferred.',
            [f'Use V_stock = V_final × M_final/M_stock = {sig(final,3)} × {sig(target,3)}/{sig(stock,3)} = {sig(aliquot,3)} mL.',
             f'The final amount is {sig(target,3)} mol/L × {final/1000:f} L = {n:f} mol before rounding.',
             'The aliquot must contain the same amount.'],
            f'{sig(aliquot,3)} mL of stock containing {sig(n,3)} mol.',SOLUTION,alternate='Find the required final moles first. Divide by stock molarity to get the aliquot in liters, then convert to mL.',
            factors=[factor(quantity(sig(final,3),'mL')),factor(quantity(sig(target,3),'mol/L','concentration'),quantity(sig(stock,3),'mol/L','concentration'))],
            precision='Use consistent volume units for the concentration ratio and keep three significant figures.')
    if family=='isotope-mixture':
        a1=rng.randint(10,84)
        a2=a1+rng.choice([1,2,3,4])
        percent=rng.randint(100,900)
        frac=D(percent)/1000
        mean=D(a1)*frac+D(a2)*(1-frac)
        return exercise(f'An invented element has isotopes of mass {a1}.000 u and {a2}.000 u for this exercise. The lighter isotope is {100*frac:.1f}% abundant. Determine the heavier isotope abundance and weighted average mass.',
            [('lighter isotope mass',f'{a1}.000','u'),('heavier isotope mass',f'{a2}.000','u'),('lighter abundance',f'{100*frac:.1f}','%')],
            'other abundance and weighted mean','weighted mean','Convert the two isotope abundances to fractions that add to one before applying the weights.',
            [f'Heavier abundance = 100.0% − {100*frac:.1f}% = {100*(1-frac):.1f}%.',
             f'Average = {a1}.000 × {frac:f} + {a2}.000 × {1-frac:f} = {mean:.3f} u.',
             'The average must lie between the isotope masses.'],
            f'{100*(1-frac):.1f}% heavier isotope. Calculated mean = {mean:.3f} u before any course-specific reporting convention.',C+'2-3-atomic-structure-and-symbolism',
            assumptions='Synthetic data represent an imaginary element. The exercise asks for the calculated mean.',alternate=f'Start from the lighter isotope mass and add the heavier isotope fraction times the mass difference {a2-a1} u.')
    if family=='empirical-formula':
        sub=rng.choice([(1,2,1),(2,4,1),(3,6,2),(2,6,1),(1,4,1),(3,8,2),(4,8,3),(5,10,2)])
        scale=rng.randint(100,999)
        masses=[D(s)*D(scale)*D(m)/10000 for s,m in zip(sub,['12.01','1.008','16.00'])]
        empirical=''.join(symbol+(str(s) if s>1 else '') for symbol,s in zip('CHO',sub))
        return exercise(f'An invented elemental-analysis dataset contains {masses[0]:f} g C, {masses[1]:f} g H and {masses[2]:f} g O. Using C = 12.01, H = 1.008 and O = 16.00 g/mol, determine the simplest atom ratio and empirical formula.',
            [(symbol,f'{mass:f}','g') for symbol,mass in zip('CHO',masses)],'simplest atom ratio and empirical formula','compare mole amounts',
            'Mass ratios are weighted by atomic masses. Convert to element amounts before finding the atom ratio.',
            [f'Divide each mass by its element molar mass. The mole amounts are {", ".join(str(D(s)*D(scale)/10000) for s in sub)}.',
             f'Divide by the common factor {D(scale)/10000:f} mol to obtain {sub[0]} : {sub[1]} : {sub[2]}.',
             'Use the smallest whole numbers as subscripts.'],
            f'Atom ratio {sub[0]}:{sub[1]}:{sub[2]}. Empirical formula {empirical}.',C+'3-2-determining-empirical-and-molecular-formulas',
            assumptions='Exact synthetic compositions for ratio practice. An empirical formula alone does not establish molecular structure.',
            alternate='Normalize by the smallest amount first, then find the lowest common multiplier that makes all ratios integers.')
    if family=='gas-compare':
        pressure=a; volume=b; t1=D(rng.randint(280,350)); t2=D(rng.randint(380,510))
        p2=pressure*t2/t1; v2=volume*t2/t1
        return exercise(f'Two copies of an ideal gas sample start at {sig(pressure,3)} atm, {sig(volume,3)} L and {sig(t1,3)} K. Each reaches {sig(t2,3)} K. Sample A is held at fixed volume and B at fixed pressure. What are A’s final pressure and B’s final volume?',
            [('initial pressure',sig(pressure,3),'atm'),('initial volume',sig(volume,3),'L'),('initial temperature',sig(t1,3),'K'),('final temperature',sig(t2,3),'K')],
            'constant-volume pressure and constant-pressure volume','choose the gas relationship from the fixed quantity',
            'The variables allowed to change are different. Both calculations use absolute temperatures and a fixed amount of gas.',
            [f'The temperature ratio is {t2}/{t1} ≈ {t2/t1:.7g}.',f'A uses P₂ = P₁T₂/T₁ ≈ {p2:.7g} atm.',
             f'B uses V₂ = V₁T₂/T₁ ≈ {v2:.7g} L. The larger absolute temperature raises the free variable.'],
            f'A: {sig(p2,3)} atm. B: {sig(v2,3)} L.',GAS,alternate='Write the ideal gas law for both states. Divide final by initial and cancel the fixed amount, gas constant and the fixed state variable.',
            factors=[factor(quantity(sig(pressure,3),'atm')),factor(quantity(sig(t2,3),'K','temperature'),quantity(sig(t1,3),'K','temperature'))],
            precision='Each displayed state measurement carries three significant figures.')
    if family=='heat-and-state':
        mass=a*10; c_heat=D('4.184')
        t1=D(rng.randint(140,320))/10; delta=D(rng.randint(25,299))/10
        tf=t1+delta; heat=mass*c_heat*delta
        digits=min(3,len(D(f'{delta:.1f}').as_tuple().digits))
        return exercise(f'A {sig(mass,3)} g sample of liquid water warms from {t1:.1f} °C to {tf:.1f} °C. Use c = 4.184 J/(g·°C) with no phase change. What heat is transferred into the water in kJ?',
            [('sample mass',sig(mass,3),'g'),('initial temperature',f'{t1:.1f}','°C'),('final temperature',f'{tf:.1f}','°C'),('specific heat','4.184','J/(g·°C)')],
            'heat gain in kJ','specific heat and joule conversion','The requested quantity is heat transfer to a sample that stays in one phase. The temperature interval and heat capacity determine it.',
            [f'ΔT = {tf:.1f} − {t1:.1f} = {delta:.1f} °C.',f'q = {sig(mass,3)} × 4.184 × {delta:.1f} = {heat:f} J before rounding.',
             f'Convert J to kJ with 1 kJ / 1000 J. The sample warms, so q is positive.'],
            f'+{sig(heat/1000,digits)} kJ.',HEAT,alternate='Calculate the heat capacity of the whole sample in kJ/°C first, then multiply by ΔT.',
            factors=[factor(quantity(sig(mass,3),'g','mass')),factor(quantity('4.184','J','heat'),{'value':'1','units':[{'text':'g','cancel':'mass'},{'text':'°C','cancel':'temperature'}]}),factor(quantity(f'{delta:.1f}','°C','temperature')),factor(quantity('1','kJ'),quantity('1000','J','heat'))],
            precision=f'Determine the temperature difference to tenths of a degree, then apply the limiting {digits} significant figures in the product.',target_unit='kJ',result=sig(heat/1000,digits))
    if family=='hess-path':
        x,y,z=(rng.randint(25,495) for _ in range(3))
        one,two,three=(D(x)/10,-D(y)/10,-D(z)/10)
        answer=one-two+three
        return exercise(f'Use hypothetical phases of the same substance. The enthalpies are A → B: +{one:.1f} kJ, C → B: {two:.1f} kJ, and C → D: {three:.1f} kJ. Find ΔH for A → D.',
            [('A → B',f'+{one:.1f}','kJ'),('C → B',f'{two:.1f}','kJ'),('C → D',f'{three:.1f}','kJ')],
            'enthalpy for A → D','Hess’s law with one reversal','Match the target direction and cancel matching intermediate states.',
            [f'Reverse C → B, so B → C has ΔH = {-two:+.1f} kJ.', 'Adding A → B, B → C and C → D cancels B and C.',
             f'ΔH = {one:.1f} − ({two:.1f}) + ({three:.1f}) = {answer:+.1f} kJ.'],
            f'ΔH(A → D) = {answer:+.1f} kJ.',C+'5-3-enthalpy',alternate='Assign H(A)=0 as a reference, compute H(B), H(C), and H(D) in sequence, then subtract H(A) from H(D).',
            precision='All stated enthalpy changes are given to tenths of a kJ.',target_unit='kJ',result=f'{answer:.1f}')
    if family=='reaction-yield':
        h,o=rng.sample(range(10,230),2)
        actual_percent=rng.randint(55,95)
        product=min(h,2*o)
        actual=Fraction(product*actual_percent,100)
        limiting='H₂' if h<2*o else ('O₂' if h>2*o else 'both react completely in stoichiometric proportion')
        return exercise(f'On paper, use 2 H₂ + O₂ → 2 H₂O with {h} mol H₂ and {o} mol O₂. A hypothetical result is {float(actual):.2f} mol H₂O. Identify the limiting case, theoretical yield, and percent yield.',
            [('H₂ amount',str(h),'mol'),('O₂ amount',str(o),'mol'),('actual H₂O',f'{float(actual):.2f}','mol')],
            'limiting case and both yield quantities','compare possible product from both reactants','Use the balanced coefficients to compare a common product basis.',
            [f'{h} mol H₂ could supply {h} mol H₂O. {o} mol O₂ could supply {2*o} mol H₂O.',
             f'The theoretical yield is the smaller value, {product} mol. Limiting case: {limiting}.',
             f'Percent yield = {float(actual):.2f}/{product} × 100% = {actual_percent}%.'],
            f'Limiting case: {limiting}. Theoretical yield {product} mol H₂O. Percent yield {actual_percent}%.',C+'4-4-reaction-yields',
            assumptions='Paper-only stoichiometry with exact synthetic values.',alternate='Divide each initial amount by its reactant coefficient and select the smaller reaction extent.')
    raise ValueError(family)

CHEM_FAMILIES = {
    'CHEM 1405': ('mass-to-particles','displacement-density','solution-mass','dilution-aliquot','isotope-mixture','empirical-formula','reaction-yield'),
    'CHEM 1406': ('solution-mass','dilution-aliquot','displacement-density','empirical-formula','gas-compare','heat-and-state','mass-to-particles'),
    'CHEM 1411': ('gas-compare','heat-and-state','hess-path','reaction-yield','empirical-formula','isotope-mixture','mass-to-particles','dilution-aliquot'),
}

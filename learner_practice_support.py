"""Pure record-format and numeric validation helpers from the original draft builder."""

import itertools
import math
import re
from collections import defaultdict
from fractions import Fraction

from draft_practice import NA, SIGFIG, UNITS

DATE = "2026-11-24"

PRACTICE_TUTORING = {
    'mass-to-particles': 'Which factor removes grams first? Which factor removes moles next?',
    'displacement-density': 'Which cylinder readings should you subtract to isolate sample volume?',
    'solution-mass': 'What is the final volume in liters, and which quantity connects it to solute amount?',
    'gas-compare': 'Which variable stays fixed in A? Which stays fixed in B?',
    'heat-and-state': 'Find the temperature difference and decide whether heat enters or leaves the sample.',
    'hess-path': 'Which reaction is written in the opposite direction from the target path?',
    'reaction-yield': 'How much of the same product could each reactant yield?',
    'allele-counting': 'How many allele copies does a heterozygote contribute to the numerator and denominator?',
    'inheritance-two-loci': 'Start with the chance of one specified genotype at the first locus.',
    'meiosis-sample': 'What separated at meiosis I? What is still attached?',
    'ecosystem-energy': 'What remains after producers use some energy in respiration?',
}

def canonical(value):
    # Genotype capitalization is scientific data. Keep it while folding
    # the surrounding prose so AA, Aa and aa remain distinct.
    segments = re.split(r'\b([Aa]{2}[Bb]{2}|[Aa]{2}|[Bb]{2})\b',value)
    normalized = ''.join(segment if i%2 else segment.casefold() for i,segment in enumerate(segments))
    return ' '.join(normalized.split())

def course_group(course):
    return 'CHEM 1405/1406' if course in ('CHEM 1405','CHEM 1406') else course

def start_record(identifier,course,kind,topic,family,question,ids):
    return {'id':identifier,'schema_version':1,'record_kind':kind,'primary_collection':course_group(course),
            'courses':[] if course=='RESOURCES' else [course],'topic':topic,'family_id':family,
            'question':question,'source_ids':list(dict.fromkeys(ids)),'student_language_aliases':[],
            'review_status':'draft-pending-editorial-review','human_reviewed':False,'generated_on':DATE,
            'course_scope_status':'provisional-syllabus-mapping' if course!='RESOURCES' else 'published-catalog-mapping'}

def finish(row, steps, explanation, hint, answer, claims, method, alternate, **extra):
    row.update(first_tutoring_reply=explanation, diagnostic_question=hint, reference_answer=answer,
        concept_explanation=explanation, progressive_hints=[hint,steps[0]['explanation']] if steps else [hint],
        worked_solution=steps, methods=[{'title':method,'why_valid':explanation,'steps':steps},
            {'title':'Alternative setup','why_valid':'Uses the same facts and givens.', 'steps':[{'title':'Try a different setup','explanation':alternate}]}],
        claim_source_links=claims, **extra)
    return row

def make_practice(course,identifier,family,p,ref):
    source_ids=[ref(p['url'])]
    if p['factors'] and course.startswith('CHEM'):
        source_ids.append(ref(UNITS))
    if p['precision']:
        source_ids.append(ref(SIGFIG))
    if family=='mass-to-particles':
        source_ids.append(ref(NA))
    topic=family.replace('-',' ')
    row=start_record(identifier,course,'practice',topic,family,p['question'],source_ids)
    graph=[]
    for i,(label,value,unit) in enumerate(p['given'],1):
        graph.append({'id':f'given-{i}','label':label,'value':value,'unit':unit,
                      'display':f'{value} {unit}'.strip(),'origin':'provided_constant' if re.search('supplied|constant|specific heat', label) else 'given',
                      'explanation':f'The {label} is used under the conditions stated in the exercise.', 'input_ids':[]})
    used=[n['id'] for n in graph]
    steps=[]
    for i,explanation in enumerate(p['steps'],1):
        key=f'step-{i}'
        # Associate output values with the exact step and its inputs. Keep
        # expression-only steps navigable without guessing a numerical result.
        outputs=re.findall(r'(?:=|≈)\s*([+−-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?![\w./^])',explanation)
        unit=p['target_unit'] if i==len(p['steps']) and p['result'] and str(p['result']) in outputs else ''
        origin='calculated'
        preferred=outputs[-1].replace('−','-') if outputs else explanation
        graph.append({'id':key,'label':f'calculation {i}','value':preferred,'unit':unit,'origin':origin,'display':f'{preferred} {unit}'.strip(),
                      'expression':explanation,'explanation':explanation,'input_ids':used.copy(),'source_ids':source_ids})
        additional=[]
        for position,value in enumerate(dict.fromkeys(outputs[:-1]),1):
            if value==preferred:
                continue
            number_id=f'{key}-value-{position}'
            graph.append({'id':number_id,'label':f'intermediate value in step {i}','value':value.replace('−','-'),'unit':'',
                          'origin':'calculated','display':value,'expression':explanation,'explanation':explanation,
                          'input_ids':used.copy(),'source_ids':source_ids})
            additional.append(number_id)
        used=[*used,key,*additional]
        steps.append({'title':f'Step {i}','explanation':explanation,'node_id':key})
    if p['result'] is not None:
        graph.append({'id':'reported-result','label':'reported answer','value':p['result'],'unit':p['target_unit'],
                      'origin':'rounded','display':f'{p["result"]} {p["target_unit"]}',
                      'explanation':p['precision'],'expression':p['answer'],'input_ids':used[-1:],'source_ids':source_ids})
    if p['precision']:
        steps.append({'title':'Report the precision','explanation':p['precision'],**({'node_id':'reported-result'} if p['result'] is not None else {})})
    hint=PRACTICE_TUTORING.get(family,'Which given connects directly to '+p['target']+'?')
    breakdown=[{'phrase':f'{v} {u}'.strip(),'meaning':label,'role':'Starting quantity or supplied property'} for label,v,u in p['given']]
    if p['assumptions']:
        breakdown.append({'phrase':p['assumptions'],'meaning':'Model conditions','role':'Check that the method applies'})
    breakdown.append({'phrase':p['target'],'meaning':'Requested output','role':'This is what the calculation must return'})
    claims=[{'claim_id':f'method-step-{i}','supports':[f'worked_solution[{i-1}]'],'source_ids':source_ids,
             'origin':'Original solution with a source for the method'} for i in range(1,len(steps)+1)]
    return finish(row,steps,p['reasoning'],hint,p['answer'],claims,p['method'],p['alternate'],
        provenance=graph,word_problem_breakdown=breakdown,unit_chain=p['factors'],assumptions=p['assumptions'],
        rounding_explanation=p['precision'],answer_unit=p['target_unit'],reported_value=p['result'],
        unit_explanation='Read the factors from left to right. Matching units on opposite sides of a fraction cancel.' if p['factors'] else None,
        content_origin='Original parameterized classroom problem and computed solution')

def validate(row,sources):
    required=['id','question','reference_answer','diagnostic_question','worked_solution','source_ids','claim_source_links','methods']
    assert all(row.get(key) for key in required),row['id']
    for source in row['source_ids']+list(itertools.chain.from_iterable(c['source_ids'] for c in row['claim_source_links'])):
        assert source in sources,(row['id'],source)
    unit_cancellations=defaultdict(lambda:[0,set()])
    for part in row.get('unit_chain',[]):
        for pos,sign in [('top',1),('bottom',-1)]:
            for unit in (part.get(pos) or {}).get('units',[]):
                if unit.get('cancel'):
                    state=unit_cancellations[unit['cancel']]
                    state[0]+=sign
                    state[1].add(unit['text'])
    assert all(count==0 and len(labels)==1 for count,labels in unit_cancellations.values()),row['id']

def near(value, goal, tolerance):
    return abs(float(value)-float(goal)) <= tolerance

def independent_math(row):
    given={node['label']:node['value'].replace(',','') for node in row['provenance'] if node['id'].startswith('given-')}
    v=lambda label:Fraction(given[label])
    answer=row['reference_answer']
    # ASCII floats are enough for these checks because tolerances reflect the
    # precision of the text shown to the learner. The reference uses fractions.
    shown=re.findall(r'(?<![\w−])[-+]?\d[\d,]*(?:\.\d+)?(?:E[+-]?\d+)?(?![\w])',answer)
    result=row.get('reported_value')
    f=row['family_id']
    digits3=.005
    if f=='mass-to-particles':
        n=v('sample mass')/v('supplied molar mass')
        expected=n*Fraction('6.02214076e23')
        assert math.isclose(float(result),float(expected),rel_tol=digits3)
        assert math.isclose(float(answer.split(' mol')[0]),float(n),rel_tol=digits3)
    elif f=='solution-mass':
        expected=v('final solution volume')*v('molarity')*v('supplied molar mass')/1000
        assert math.isclose(float(result),float(expected),rel_tol=digits3)
    elif f=='heat-and-state':
        expected=v('sample mass')*v('specific heat')*(v('final temperature')-v('initial temperature'))/1000
        assert math.isclose(float(result),float(expected),rel_tol=.05)
    elif f=='hess-path':
        assert Fraction(result)==v('A → B')-v('C → B')+v('C → D')
    elif f=='displacement-density':
        vol=v('final water level')-v('initial water level')
        actual=re.search(r'Volume = (\S+) mL and density = (\S+) g/mL',answer)
        assert actual and Fraction(actual[1])==vol and math.isclose(float(actual[2]),float(v('sample mass')/vol),rel_tol=.05)
    elif f=='dilution-aliquot':
        moles=v('target molarity')*v('final volume')/1000
        actual=re.search(r'^(\S+) mL of stock containing (\S+) mol',answer)
        assert actual and math.isclose(float(actual[1]),float(1000*moles/v('stock molarity')),rel_tol=digits3)
        assert math.isclose(float(actual[2]),float(moles),rel_tol=digits3)
    elif f=='gas-compare':
        ratio=v('final temperature')/v('initial temperature')
        actual=re.search(r'A: (\S+) atm\. B: (\S+) L',answer)
        assert actual
        assert math.isclose(float(actual[1]),float(v('initial pressure')*ratio),rel_tol=digits3)
        assert math.isclose(float(actual[2]),float(v('initial volume')*ratio),rel_tol=digits3)
    elif f=='isotope-mixture':
        abundance=v('lighter abundance')/100
        expected=v('lighter isotope mass')*abundance+v('heavier isotope mass')*(1-abundance)
        assert Fraction(shown[0])==100*(1-abundance) and near(Fraction(shown[1]),expected,.0005)
    elif f=='empirical-formula':
        ratio=[v(x)/m for x,m in zip('CHO',map(Fraction,['12.01','1.008','16.00']))]
        actual=list(map(int,re.search(r'Atom ratio (\d+):(\d+):(\d+)',answer).groups()))
        assert len({amount/count for amount,count in zip(ratio,actual)})==1
        assert math.gcd(*actual)==1
    elif f=='reaction-yield':
        h,o=v('H₂ amount'),v('O₂ amount')
        actual=re.search(r'Theoretical yield (\d+) mol H₂O\. Percent yield (\d+)%',answer)
        assert actual and int(actual[1])==min(h,2*o)
        assert Fraction(actual[2])==100*v('actual H₂O')/min(h,2*o)
    elif f=='glycolysis-budget':
        total=v('glucose in A')+v('glucose in B')
        assert [int(x) for x in shown[:2]]==[4*total,2*total]
    elif f=='citric-carbon-carriers':
        turns=v('glucose molecules')*2+v('additional acetyl-CoA')
        assert [int(x) for x in shown[:2]]==[2*turns,3*turns]
    elif f=='meiosis-sample':
        assert int(shown[-1])==v('diploid chromosome number')*v('cells pictured')
    elif f=='inheritance-two-loci':
        p1,p2=given['parent 1'],given['parent 2']
        target=given['target']
        count=0
        for a in itertools.product(p1[:2],p1[2:]):
            for b in itertools.product(p2[:2],p2[2:]):
                genotype=''.join(sorted(a[0]+b[0])+sorted(a[1]+b[1]))
                count += genotype==target
        expected=1-(1-Fraction(count,16))**int(v('number of offspring'))
        actual=re.search(r'exact fraction (\d+(?:/\d+)?)',answer)
        assert actual and Fraction(actual[1])==expected
    elif f=='membrane-model':
        ratio=v('inside concentration')/v('bath concentration')
        assert math.isclose(float(shown[-1]),float(ratio*v('starting volume')),rel_tol=.0005)
        assert ('moves into' in answer)==(ratio>1)
    elif f=='calvin-resources':
        total=v('net G3P in first diagram')+v('net G3P in second diagram')
        assert list(map(int,shown[:3]))==[3*total,9*total,6*total]
    elif f=='mitotic-index':
        a,b,c,d=(v(label) for label in ['field A mitotic','field A total','field B mitotic','field B total'])
        for observed,expected in zip(shown,[100*a/b,100*c/d,100*(a+c)/(b+d)]):
            assert near(observed,expected,.005001)
    elif f=='enzyme-data':
        a=v('product in A')/v('A interval');b=v('product in B')/v('B interval')
        assert near(shown[0],a,.00005001) and near(shown[1],b,.00005001)
        assert answer.endswith(f'Faster sample: {"A" if a>b else "B" if a<b else "neither"}.')
    elif f=='allele-counting':
        a,b,c=(v(k) for k in ['AA','Aa','aa'])
        p=(a+b/2)/(a+b+c)
        for observed,expected in zip(shown,[p,b/(a+b+c),2*p*(1-p)]):
            assert near(observed,expected,.00005001)
    elif f=='ecosystem-energy':
        net=v('gross production')-v('respiration')
        secondary=net*v('first transfer')*v('second transfer')/10000
        actual=re.search(r'NPP = (\S+) kJ/m²/year\. Secondary production ≈ (\S+)',answer)
        assert actual and Fraction(actual[1])==net and math.isclose(float(actual[2]),float(secondary),rel_tol=1e-5)
    elif f=='logistic-compare':
        a,b=(v(k) for k in ['first N','second N'])
        k,r=(v(key) for key in ['K','r'])
        expected=[r*n*(1-n/k) for n in (a,b)]
        assert len(shown)>=2 and all(near(n,exp,.000501) for n,exp in zip(shown[-2:],expected))
    elif f=='demographic-balance':
        start=v('initial')
        change=v('births')-v('deaths')+v('immigration')-v('emigration')
        assert Fraction(shown[0])==start+change and near(shown[1],100*change/start,.005001)
    elif f=='hardy-recessive':
        f_aa=v('recessive phenotype')/100
        q=Fraction(math.isqrt(f_aa.numerator),math.isqrt(f_aa.denominator))
        assert q*q==f_aa
        expected=[v('population size')*2*q*(1-q),v('population size')*(1-q)**2]
        assert [int(n.replace(',','')) for n in shown[:2]]==expected
    elif f=='mark-recapture':
        expected=v('initial marked count')*v('second sample')/v('marked recaptures')
        assert int(shown[0])==int(expected+Fraction(1,2))
    else:
        raise AssertionError(f'No independent checker for {f}')

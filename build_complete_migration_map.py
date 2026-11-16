import json
import openpyxl
import re
from difflib import SequenceMatcher

# 1. Load data
with open('./data_backup/current_tools.json', 'r', encoding='utf-8') as f:
    old_tools = json.load(f)

with open('./data_backup/current_transactions.json', 'r', encoding='utf-8') as f:
    current_transactions = json.load(f)

wb = openpyxl.load_workbook('list tool.xlsx')
ws = wb.active
headers = [c.value for c in ws[1]]
new_tools = []
for r in range(2, ws.max_row + 1):
    row_vals = [ws.cell(row=r, column=c).value for c in range(1, len(headers) + 1)]
    item = {headers[i]: row_vals[i] for i in range(len(headers))}
    if item.get('id'):
        new_tools.append(item)

old_by_id = {str(t['id']).strip(): t for t in old_tools}
new_by_id = {str(t['id']).strip(): t for t in new_tools}

def get_tag(name):
    m = re.findall(r'\((.*?)\)', str(name))
    return m[-1].strip().upper() if m else None

def clean_text(s):
    if not s:
        return ""
    s = re.sub(r'\(.*?\)', '', str(s))
    s = re.sub(r'[^a-zA-Z0-9]', ' ', s).lower()
    return ' '.join(s.split())

new_by_tag = {}
for nt in new_tools:
    t = get_tag(nt.get('name'))
    if t:
        new_by_tag[t] = nt

tx_tool_usage = {}
for tx in current_transactions:
    tid = str(tx.get('tool_id', '')).strip()
    tname = str(tx.get('tool_name', '')).strip()
    if tid not in tx_tool_usage:
        tx_tool_usage[tid] = {'names': set(), 'count': 0, 'latest_name': tname}
    tx_tool_usage[tid]['names'].add(tname)
    tx_tool_usage[tid]['count'] += 1
    tx_tool_usage[tid]['latest_name'] = tname

# Custom known mappings
custom_overrides = {
    'TLR-709': 'TLR-705', # TOOL BOX KTC A
    'TLR-710': 'TLR-706', # TOOL BOX KTC B
    'TLR-676': 'TLR-657', # JUMP STARTER
    'TLR-630': 'TLR-629', # CORDLESS IMPACT WRENCH BOX (GT6 No.11)
    'TLR-558': 'TLR-559', # ELECRTIC DRILL (GT2 No.1)
    'TLR-559': 'TLR-560', # ELECTRIC DRILL (GT2 No.2)
    'TLR-560': 'TLR-561', # ANGLE GRINDER (GT2 No.3)
    'TLR-561': 'TLR-562', # ANGLE GRINDER (GT2 No.4)
    'TLR-562': 'TLR-563', # MABLE CUTTER (GT2 No.5)
    'TLR-564': 'TLR-565', # ELECTRIC DRILL (GT2 No.7)
    'TLR-566': 'TLR-567', # ANGLE GRINDER (GT2 No.9)
    'TLR-567': 'TLR-568', # JIG SAW (GT2 No.10)
    'TLR-653': 'TLR-659', # CORDLESS BLOWER (GT8 No.2)
    'TLR-654': 'TLR-660', # CORDLESS BLOWER (GT8 No.3)
    'TLR-526': 'TLR-527', # WATER PUMP (GT1 No.3)
    'TLR-660': 'TLR-666', # THERMOMETER (GT8 No.9)
    'TLR-661': 'TLR-667', # CLAMP METER (GT8 No.10)
    'TLR-621': 'TLR-620', # CORDLESS DRILL BOX (GT6 No.2)
    'TLR-629': 'TLR-628', # AIR CONDITIONING REFRIGERANT GAUGE BOX (GT6 No.10)
    'TLR-632': 'TLR-631', # EXTENSION CORD REEL (GT6 No.13)
    'TLR-657': 'TLR-663', # LIGHT BULB TESTER (GT8 No.6)
    'TLR-708': 'TLR-635', # CORDLESS IMPACT WRENCH MEDIUM BOX (GT6 No.17)
    'TLR-715': 'TLR-655', # CORDLESS ANGLE GRINDER
    'TLR-707': 'TLR-637', # CORDLESS ANGLE GRINDER (SCG-600)
    'TLR-701': 'TLR-697', # JACK LARGE
    'TLR-700': 'TLR-690', # JACK LARGE
    'TLR-702': 'TLR-702', # POSITION TRANSMISSION JACK
    'TLR-703': 'TLR-691', # JACK SMALL
    'TLR-711': 'TLR-697', # Pneumatic Jack
    'TLR-712': 'TLR-697', # Pneumatic Jack
    'TLR-720': 'TLR-697', # Pneumatic Jack
    'TLR-536': 'TLR-528', # VACUUM PUMP (GT1 No.4)
    'TLR-527': 'TLR-529', # VACUUM PUMP (GT1 No.5)
    'TLR-649': 'TLR-652', # TAP & DIE SET BLACK
    'TLR-600': 'TLR-609', # MANUAL CHAIN HOIST (or keep if retired)
    'TLR-601': 'TLR-610',
    '706':     'TLR-697', # JACK LARGE
}

full_mapping = {}

for tid, info in tx_tool_usage.items():
    norm_tid = tid
    if re.match(r'^\d+$', tid):
        norm_tid = f"TLR-{int(tid):03d}"
        
    old_tool = old_by_id.get(norm_tid) or old_by_id.get(tid)
    old_name = info['latest_name'] or (old_tool.get('name') if old_tool else '')
    old_loc = old_tool.get('location', '') if old_tool else ''
    
    target_new = None
    reason = ""
    
    # 1. Custom override
    if tid in custom_overrides:
        target_new = new_by_id.get(custom_overrides[tid])
        reason = f"Verified Override -> {custom_overrides[tid]}"
    elif norm_tid in custom_overrides:
        target_new = new_by_id.get(custom_overrides[norm_tid])
        reason = f"Verified Override -> {custom_overrides[norm_tid]}"
    
    # 2. Tag match
    if not target_new:
        tag = get_tag(old_name) or (get_tag(old_tool.get('name')) if old_tool else None)
        if tag and tag in new_by_tag:
            target_new = new_by_tag[tag]
            reason = f"Exact Tag '({tag})'"
            
    # 3. Exact clean name + loc match
    if not target_new:
        c_old_name = clean_text(old_name)
        for nt in new_tools:
            c_new = clean_text(nt.get('name'))
            if c_old_name and c_old_name == c_new and str(nt.get('location', '')).strip() == old_loc:
                target_new = nt
                reason = "Exact Name + Location"
                break

    # 4. Exact ID + Name match
    if not target_new:
        if norm_tid in new_by_id and clean_text(new_by_id[norm_tid].get('name')) == clean_text(old_name):
            target_new = new_by_id[norm_tid]
            reason = "Exact ID & Name"

    # 5. Exact Name match
    if not target_new:
        c_old_name = clean_text(old_name)
        exact_matches = [nt for nt in new_tools if clean_text(nt.get('name')) == c_old_name]
        if len(exact_matches) == 1:
            target_new = exact_matches[0]
            reason = "Exact Name"

    if target_new:
        full_mapping[tid] = {
            'old_id': tid,
            'norm_id': norm_tid,
            'old_name': old_name,
            'new_id': target_new.get('id'),
            'new_name': target_new.get('name'),
            'reason': reason,
            'tx_count': info['count']
        }
    else:
        # If no match in new list, keep original ID and name
        full_mapping[tid] = {
            'old_id': tid,
            'norm_id': norm_tid,
            'old_name': old_name,
            'new_id': norm_tid,
            'new_name': old_name,
            'reason': "Retained (No direct new match)",
            'tx_count': info['count']
        }

total_tx = sum(m['tx_count'] for m in full_mapping.values())
retained = [m for m in full_mapping.values() if 'Retained' in m['reason']]
changed = [m for m in full_mapping.values() if 'Retained' not in m['reason']]

print(f"Total mapped tool IDs: {len(full_mapping)}")
print(f"Updated tools: {len(changed)} (covers {sum(m['tx_count'] for m in changed)} txs)")
print(f"Retained as-is tools: {len(retained)} (covers {sum(m['tx_count'] for m in retained)} txs)")
print(f"Total transactions covered: {total_tx} / {len(current_transactions)}")

# Save full mapping to json
with open('./data_backup/full_tool_mapping.json', 'w', encoding='utf-8') as f:
    json.dump(full_mapping, f, ensure_ascii=False, indent=2)

print("Saved full_tool_mapping.json successfully.")

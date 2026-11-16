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

# All unique tools in transactions
# Some older transactions have numeric IDs like 646, 219, etc. which were row numbers or old IDs
tx_tool_usage = {}
for tx in current_transactions:
    tid = str(tx.get('tool_id', '')).strip()
    tname = str(tx.get('tool_name', '')).strip()
    if tid not in tx_tool_usage:
        tx_tool_usage[tid] = {'names': set(), 'count': 0, 'latest_name': tname}
    tx_tool_usage[tid]['names'].add(tname)
    tx_tool_usage[tid]['count'] += 1
    tx_tool_usage[tid]['latest_name'] = tname

print(f"Total transactions: {len(current_transactions)}")
print(f"Total unique tool IDs in transactions: {len(tx_tool_usage)}")

# Now for each unique tool in transactions, find match in new_tools
mapping = {} # tid -> new_tool
unmatched = []

for tid, info in tx_tool_usage.items():
    # 1. Is tid like TLR-xxx or a number?
    norm_tid = tid
    if re.match(r'^\d+$', tid):
        norm_tid = f"TLR-{int(tid):03d}"
    
    old_tool = old_by_id.get(norm_tid) or old_by_id.get(tid)
    old_name = info['latest_name'] or (old_tool.get('name') if old_tool else '')
    old_loc = old_tool.get('location', '') if old_tool else ''
    
    # Method A: Match by tag in name
    tag = get_tag(old_name)
    if not tag and old_tool:
        tag = get_tag(old_tool.get('name'))
        
    matched_new = None
    match_method = None
    
    if tag and tag in new_by_tag:
        matched_new = new_by_tag[tag]
        match_method = f"TAG ({tag})"
    elif norm_tid in new_by_id and clean_text(new_by_id[norm_tid].get('name')) == clean_text(old_name):
        matched_new = new_by_id[norm_tid]
        match_method = "EXACT ID & NAME"
    else:
        # Try finding by exact clean name + location
        c_old_name = clean_text(old_name)
        candidates = []
        for nt in new_tools:
            c_new = clean_text(nt.get('name'))
            if c_new == c_old_name:
                candidates.append(nt)
        if len(candidates) == 1:
            matched_new = candidates[0]
            match_method = "EXACT NAME"
        elif len(candidates) > 1:
            # Check location
            loc_match = [c for c in candidates if clean_text(c.get('location')) == clean_text(old_loc)]
            if len(loc_match) == 1:
                matched_new = loc_match[0]
                match_method = "NAME + LOCATION"
            else:
                # Pick candidate with closest ID or same ID
                same_id = [c for c in candidates if str(c.get('id')).strip() == norm_tid]
                if same_id:
                    matched_new = same_id[0]
                    match_method = "NAME + ID"
                else:
                    matched_new = candidates[0]
                    match_method = "NAME (FIRST)"
                    
    if matched_new:
        mapping[tid] = {
            'old_id': tid,
            'norm_id': norm_tid,
            'old_name': old_name,
            'new_id': matched_new.get('id'),
            'new_name': matched_new.get('name'),
            'method': match_method,
            'tx_count': info['count']
        }
    else:
        unmatched.append((tid, norm_tid, old_name, old_loc, info['count']))

print(f"\nSuccessfully matched: {len(mapping)} tools (covering {sum(m['tx_count'] for m in mapping.values())} transactions)")
print(f"Unmatched: {len(unmatched)} tools (covering {sum(u[4] for u in unmatched)} transactions)")

if unmatched:
    print("\n--- UNMATCHED LIST ---")
    for u in sorted(unmatched, key=lambda x: x[4], reverse=True)[:30]:
        print(f"TxCount {u[4]:4d} | ID: {u[0]:8} | Name: '{u[2]}' | Loc: '{u[3]}'")

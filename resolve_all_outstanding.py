import json
import openpyxl
import re

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

def clean_text(s):
    if not s:
        return ""
    s = re.sub(r'\(.*?\)', '', str(s))
    s = re.sub(r'[^a-zA-Z0-9]', ' ', s).lower()
    return ' '.join(s.split())

# Calculate current outstanding
sorted_txs = sorted(current_transactions, key=lambda x: str(x.get('date', '')))
outstanding = []
for tx in sorted_txs:
    action = str(tx.get('action', '')).upper().strip()
    if action == 'BORROW':
        outstanding.append(tx)
    elif action == 'RETURN':
        tid = str(tx.get('tool_id', '')).strip().lower()
        eid = str(tx.get('employee_id', '')).strip().lower()
        for idx, item in enumerate(outstanding):
            if str(item.get('tool_id', '')).strip().lower() == tid and str(item.get('employee_id', '')).strip().lower() == eid:
                outstanding.pop(idx)
                break

print(f"Total outstanding: {len(outstanding)}")

results = []
for item in outstanding:
    otid = str(item.get('tool_id', '')).strip()
    otname = str(item.get('tool_name', '')).strip()
    old_item = old_by_id.get(otid, {})
    old_loc = old_item.get('location', '')
    
    target_new = None
    reason = ""
    
    # 1. Tag Match
    tags = re.findall(r'\((.*?)\)', otname)
    tag = tags[-1].strip().upper() if tags else None
    if tag:
        for nt in new_tools:
            if f"({tag})" in str(nt.get('name', '')):
                target_new = nt
                reason = f"Exact Tag Match '({tag})'"
                break
                
    # 2. Name + Location Match (e.g. ELECTRIC DRILL at GT2 No.1)
    if not target_new:
        c_old_name = clean_text(otname)
        for nt in new_tools:
            c_new_name = clean_text(nt.get('name'))
            if (c_old_name == c_new_name or c_old_name in c_new_name) and str(nt.get('location', '')).strip() == old_loc:
                target_new = nt
                reason = f"Name + Location Match '{old_loc}'"
                break

    # 3. Exact Clean Name Match (regardless of location)
    if not target_new:
        c_old_name = clean_text(otname)
        exact_matches = [nt for nt in new_tools if clean_text(nt.get('name')) == c_old_name]
        if len(exact_matches) == 1:
            target_new = exact_matches[0]
            reason = f"Exact Name Match '{otname}'"

    # 4. Specific special cases
    if not target_new:
        if 'TOOL BOX KTC A' in otname.upper():
            target_new = new_by_id.get('TLR-705')
            reason = "Tool Box KTC A -> TLR-705"
        elif 'TOOL BOX KTC B' in otname.upper():
            target_new = new_by_id.get('TLR-706')
            reason = "Tool Box KTC B -> TLR-706"
        elif 'JUMP STARTER' in otname.upper():
            target_new = new_by_id.get('TLR-657')
            reason = "Jump Starter -> TLR-657"

    results.append({
        'old_id': otid,
        'old_name': otname,
        'old_loc': old_loc,
        'new_id': target_new.get('id') if target_new else '???',
        'new_name': target_new.get('name') if target_new else '???',
        'new_loc': target_new.get('location') if target_new else '???',
        'emp': f"{item.get('employee_name')} ({item.get('employee_id')})",
        'reason': reason
    })

for i, r in enumerate(results, 1):
    print(f"{i:2d}. [{r['old_id']:7} -> {r['new_id']:7}] | OLD: {r['old_name']:35} -> NEW: {r['new_name']}")
    print(f"    Emp: {r['emp']} | Loc: {r['old_loc']} -> {r['new_loc']} ({r['reason']})\n")

import json
import openpyxl
import re
from difflib import SequenceMatcher

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

print(f"Old tools: {len(old_tools)}")
print(f"New tools: {len(new_tools)}")

# Build dictionaries
old_by_id = {str(t['id']).strip(): t for t in old_tools}
new_by_id = {str(t['id']).strip(): t for t in new_tools}

# Extract unique tool_id and tool_name from all 7441 transactions
tx_tools = {}
for tx in current_transactions:
    tid = str(tx.get('tool_id', '')).strip()
    tname = str(tx.get('tool_name', '')).strip()
    if tid not in tx_tools:
        tx_tools[tid] = set()
    tx_tools[tid].add(tname)

print(f"Unique tool_ids in transactions: {len(tx_tools)}")

# Let's inspect how old tool names match new tool names
# Clean function for name matching
def clean_name(n):
    if not n:
        return ""
    # remove text in parentheses e.g. (CW-A001) or (ED-GT2001)
    s = re.sub(r'\(.*?\)', '', n)
    # remove double quotes, extra spaces
    s = re.sub(r'[^a-zA-Z0-9]', ' ', s).lower()
    return ' '.join(s.split())

# Check mapping for the 29 currently outstanding items!
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

print("\n==========================================")
print(f"DETAILED MATCHING FOR 29 OUTSTANDING TOOLS")
print("==========================================")

for i, item in enumerate(outstanding, 1):
    tid = str(item.get('tool_id', '')).strip()
    tname = str(item.get('tool_name', '')).strip()
    old_tool = old_by_id.get(tid, {})
    old_loc = old_tool.get('location', '')
    
    # Try to find candidates in new_tools
    candidates = []
    c_name = clean_name(tname)
    
    for nt in new_tools:
        nid = str(nt.get('id', '')).strip()
        nname = str(nt.get('name', '')).strip()
        cn_name = clean_name(nname)
        nloc = str(nt.get('location', '')).strip()
        
        # Calculate similarity
        sim = SequenceMatcher(None, c_name, cn_name).ratio()
        
        # Exact clean match
        if c_name == cn_name:
            candidates.append((1.0, nid, nname, nloc))
        elif c_name in cn_name or cn_name in c_name:
            candidates.append((0.85 + 0.1 * sim, nid, nname, nloc))
        elif sim > 0.7:
            candidates.append((sim, nid, nname, nloc))
            
    candidates.sort(key=lambda x: x[0], reverse=True)
    
    # Also check what is currently at the same ID in new_tools
    same_id_new = new_by_id.get(tid)
    same_id_info = f"[{same_id_new.get('id')}] '{same_id_new.get('name')}'" if same_id_new else "NOT IN NEW LIST"
    
    print(f"\n#{i:02d} [OLD: {tid}] '{tname}' (Loc: {old_loc}) | Emp: {item.get('employee_name')}")
    print(f"    Same ID in New List: {same_id_info}")
    top3 = candidates[:3]
    print(f"    Top Match Candidates:")
    for score, cid, cname, cloc in top3:
        print(f"      - ({score:.2f}) [{cid}] '{cname}' (Loc: {cloc})")

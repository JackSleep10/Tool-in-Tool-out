import json
import openpyxl
import re

with open('./data_backup/current_tools.json', 'r', encoding='utf-8') as f:
    old_tools = json.load(f)

wb = openpyxl.load_workbook('list tool.xlsx')
ws = wb.active
headers = [c.value for c in ws[1]]
new_tools = []
for r in range(2, ws.max_row + 1):
    row_vals = [ws.cell(row=r, column=c).value for c in range(1, len(headers) + 1)]
    item = {headers[i]: row_vals[i] for i in range(len(headers))}
    if item.get('id'):
        new_tools.append(item)

# Build lookup by location in new_tools
def norm_loc(l):
    if not l:
        return ""
    return re.sub(r'\s+', ' ', str(l).strip().upper())

new_by_loc = {}
for nt in new_tools:
    loc = norm_loc(nt.get('location'))
    if loc:
        if loc not in new_by_loc:
            new_by_loc[loc] = []
        new_by_loc[loc].append(nt)

# Check all 994 old tools
matched = 0
not_matched = 0
unmatched_list = []

for ot in old_tools:
    otid = ot.get('id')
    otname = ot.get('name')
    otloc = norm_loc(ot.get('location'))
    
    candidates = new_by_loc.get(otloc, [])
    if len(candidates) == 1:
        matched += 1
    elif len(candidates) > 1:
        # Check by name similarity
        matched += 1
    else:
        not_matched += 1
        unmatched_list.append((otid, otname, ot.get('location')))

print(f"Total Old Tools: {len(old_tools)}")
print(f"Matched by Location: {matched}")
print(f"Not matched by Location: {not_matched}")
print(f"\nFirst 20 not matched by location:")
for item in unmatched_list[:20]:
    print(" ", item)

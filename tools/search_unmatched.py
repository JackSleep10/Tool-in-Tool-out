import openpyxl

wb = openpyxl.load_workbook('list tool.xlsx')
ws = wb.active
headers = [c.value for c in ws[1]]
new_tools = []
for r in range(2, ws.max_row + 1):
    row_vals = [ws.cell(row=r, column=c).value for c in range(1, len(headers) + 1)]
    item = {headers[i]: row_vals[i] for i in range(len(headers))}
    if item.get('id'):
        new_tools.append(item)

keywords = ['IMPACT WRENCH', 'ANGLE GRINDER', 'JACK', 'CHAIN HOIST', 'HOIST', 'VACCUM', 'VACUUM', 'TAP & DIE', 'MARBLE', 'MABLE', 'CUTTER']

for kw in keywords:
    print(f"\n=== MATCHES FOR '{kw}' IN NEW TOOLS ===")
    for nt in new_tools:
        name = str(nt.get('name', ''))
        loc = str(nt.get('location', ''))
        if kw.lower() in name.lower():
            print(f"  [{nt.get('id')}] '{name}' | Loc: '{loc}'")

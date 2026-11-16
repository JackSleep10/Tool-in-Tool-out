import json
import csv

with open('./data_backup/full_tool_mapping.json', 'r', encoding='utf-8') as f:
    full_mapping = json.load(f)

with open('full_mapping_summary.csv', 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Old Tool ID', 'Normalized ID', 'Old Tool Name', 'New Tool ID', 'New Tool Name', 'Matching Reason', 'Transaction Count'])
    for k, v in sorted(full_mapping.items(), key=lambda x: x[1]['tx_count'], reverse=True):
        writer.writerow([v['old_id'], v['norm_id'], v['old_name'], v['new_id'], v['new_name'], v['reason'], v['tx_count']])

print("Saved full_mapping_summary.csv")

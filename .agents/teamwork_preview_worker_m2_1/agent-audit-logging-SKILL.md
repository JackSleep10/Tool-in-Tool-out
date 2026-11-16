# Agent Audit Log Reporting

## Overview
When agents make decisions, take actions, and spend money, every step must be traceable. Audit logs answer questions like: "What did the agent do?", "Why did it do that?", "Who asked for it?", and "Can we prove it followed the rules?" This skill covers event sourcing, structured logging, traceability chains, compliance reporting, and forensic analysis for production multi-agent systems.

## Structured Audit Schema
- `event_type`: "agent.action"
- `action`: "export_report"
- `agent_name`: Name of the report component
- `params`: Details of the action (format, report name, count)
- `timestamp`: Epoch timestamp
- `source`: "user"

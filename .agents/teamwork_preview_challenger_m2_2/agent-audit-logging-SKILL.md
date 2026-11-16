---
name: agent-audit-logging
description: 'Implement comprehensive audit logging and reporting for multi-agent systems. Covers event capture, structured logging, traceability, compliance reporting, forensic analysis, and real-time monitoring dashboards for agent actions and decisions.'
---

# Agent Audit Log Reporting

## Overview
When agents make decisions, take actions, and spend money, every step must be traceable. Audit logs answer questions like: "What did the agent do?", "Why did it do that?", "Who asked for it?", and "Can we prove it followed the rules?" This skill covers event sourcing, structured logging, traceability chains, compliance reporting, and forensic analysis for production multi-agent systems.

## Event Schema Definition
- `event_type`: "agent.action"
- `action`: "export_report"
- `agent_name`: string
- `params`: dict
- `timestamp`: float
- `source`: string

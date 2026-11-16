# Agent Audit Log Reporting

## Overview

When agents make decisions, take actions, and spend money, every step must be traceable. Audit logs answer questions like: "What did the agent do?", "Why did it do that?", "Who asked for it?", and "Can we prove it followed the rules?" This skill covers event sourcing, structured logging, traceability chains, compliance reporting, and forensic analysis for production multi-agent systems.

---

## Core Concepts

### Why Audit Logging Matters

| Need | Without Audit | With Audit |
|------|--------------|------------|
| **Debugging** | "The agent did something wrong, but what?" | Full replay of decisions |
| **Compliance** | No evidence of rule following | Verifiable compliance trail |
| **Billing** | "Why did we spend $5K today?" | Per-task cost attribution |
| **Security** | Can't detect injection or abuse | Pattern detection on logs |
| **Improvement** | Guess what went wrong | Data-driven optimization |
| **Accountability** | "Was this the agent or the user?" | Clear provenance |

### What to Log

| Event | Details | Priority |
|-------|---------|----------|
| **Invocation** | Task received, agent, timestamp | Required |
| **Reasoning** | Agent's chain-of-thought | Required |
| **Tool Calls** | Tool name, params, result, latency | Required |
| **Decisions** | Branch taken, confidence, rationale | Required |
| **LLM Response** | Raw model output | High |
| **Errors** | Error type, stack trace, recovery action | Required |
| **Handoffs** | Source, target, context summary | Required |
| **Human Interventions** | Override, confirmation, escalation | Required |
| **Token Usage** | Prompt/completion counts | High |
| **User Feedback** | Rating, correction, follow-up | Medium |

---

## Step-by-Step Implementation

### Step 1: Define the Audit Event Schema

```python
from dataclasses import dataclass, field, asdict
from typing import Any, Optional
from enum import Enum
import json
import time
import uuid

class EventType(Enum):
    INVOCATION = "agent.invocation"
    REASONING = "agent.reasoning"
    TOOL_CALL = "agent.tool_call"
    TOOL_RESULT = "agent.tool_result"
    DECISION = "agent.decision"
    LLM_RESPONSE = "agent.llm_response"
    ERROR = "agent.error"
    HANDOFF = "agent.handoff"
    HUMAN_INTERVENTION = "agent.human_intervention"
    TOKEN_USAGE = "agent.token_usage"

@dataclass
class AuditEvent:
    """Structured audit event for any agent action."""
    
    # Identity
    event_id: str = None
    event_type: EventType = None
    agent_name: str = ""
    task_id: str = ""
    session_id: str = ""
    
    # What happened
    action: str = ""
    params: dict = field(default_factory=dict)
    result: Any = None
    
    # Context
    reasoning: str = ""
    confidence: float = 0.0
    source: str = ""  # User, system, or parent agent
    
    # Traceability
    parent_event_id: Optional[str] = None
    trace_id: str = ""
    
    # Metadata
    timestamp: float = None
    duration_ms: float = 0.0
    token_count: int = 0
    model: str = ""
    version: str = ""
    
    # Error
    error: Optional[str] = None
    error_type: Optional[str] = None
    
    def __post_init__(self):
        if self.event_id is None:
            self.event_id = str(uuid.uuid4())
        if self.timestamp is None:
            self.timestamp = time.time()
        if not self.trace_id:
            self.trace_id = self.event_id
    
    def serialize(self) -> dict:
        """Serialize to dictionary for storage."""
        data = asdict(self)
        data["event_type"] = self.event_type.value
        data["timestamp"] = self.timestamp
        return data
```

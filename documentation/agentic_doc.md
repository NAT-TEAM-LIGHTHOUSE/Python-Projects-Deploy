**Table-GPT Agentic System Architecture [Autonomous AI Agents]**

# 1. Overview

This document describes the recommended
agentic architecture for the Table-GPT system. The system uses a node-based
workflow where an AI agent analyzes user queries, understands table schemas,
decides the correct reasoning path, executes data analysis code safely in a
sandbox, and corrects errors automatically through feedback loops.

# 2. High-Level Workflow

User Query

   ↓

Session Loader (Redis Memory)

   ↓

Schema Analyzer

   ↓

Intent Classifier

   ↓

Router

   ├── Q&A Agent

   └── Data Analysis Agent

    ↓

    Query Planner

    ↓

    Code Generator

    ↓

    Sandbox Executor

    ↓

    Error Detector

    ↓

    Code Fix Agent (Feedback Loop)

    ↓

    Final Response Formatter

# 3. Core Nodes in the Agentic System

## Session Loader

Loads conversation history and session
state from Redis memory.

## Schema Analyzer

Analyzes the dataset structure including
column names, data types, and sample values to help the LLM understand the table.

## Intent Classifier

Determines whether the user query requires
simple Q&A reasoning or full data analysis.

## Router Node

Routes the workflow to either the Q&A
agent or the data analysis agent.

## Q&A Agent

Handles general questions about table
structure, metadata, or simple descriptive queries.

## Data Analysis Agent

Handles analytical queries requiring
aggregations, filtering, grouping, or statistical analysis.

## Query Planner

Breaks complex analytical queries into
step-by-step logical operations before code generation.

## Code Generator

Generates Python code (typically using
Pandas) to perform the required analysis.

## Sandbox Executor

Runs the generated code in a secure
isolated environment to avoid security risks.

## Error Detector

Detects runtime or syntax errors produced
during execution.

## Code Fix Agent

Uses LLM reasoning to repair failing code
and retry execution automatically.

## Final Response Formatter

Converts execution output into a
user-friendly answer.

# 4. Key Capabilities of the System

• Intelligent intent detection

• Automatic schema understanding

• Dynamic routing between reasoning paths

• LLM-driven code generation

• Secure sandbox execution environment

• Self-healing error correction loop

• Persistent session memory with Redis

• Scalable node-based orchestration

# 5. Recommended Technology Stack

Agent Orchestration: LangGraph

API Layer: FastAPI

Memory Store: Redis

Sandbox Execution: LLM Sandbox or Docker Container

Data Processing: Pandas

Model Provider: OpenAI / compatible LLM

# 6. Benefits of this Architecture

This architecture enables the Table-GPT system to behave like an autonomous
data analysis agent.

It can understand dataset structure, reason about user questions, execute
analysis safely, and automatically

correct errors during execution. The modular node-based workflow also makes the
system easier to extend and scale.

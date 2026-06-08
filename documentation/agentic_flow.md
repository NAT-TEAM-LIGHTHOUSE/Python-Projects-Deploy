User Query
   │
   ▼
Load Session Memory (Redis)
   │
   ▼
Schema Analyzer
   │
   ▼
Intent Classifier
   │
   ├──► Q&A Agent
   │
   └──► Data Analysis Agent
             │
             ▼
        Code Generator
             │
             ▼
      Sandbox Execution
             │
       Error Found?
        │      │
       YES     NO
        │      │
        ▼      ▼
     Code Fix  Final Answer

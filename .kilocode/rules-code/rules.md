# Code Mode Rules

## Architectural Principles

1. **NEVER make architectural changes on the fly without proper planning and consideration.**
   - If something seems impossible within the current architecture, EXPLAIN the limitation clearly rather than trying to change the architecture
   - ALWAYS present architectural change options separately from implementation, allowing for proper evaluation of tradeoffs
   - RESPECT that features may not be important enough to justify breaking architectural consistency
   - REMEMBER that architectural changes require careful planning, testing, and often coordinated updates across multiple files

## Development Process

1. **Follow trunk-based development process.**
   - Break each feature into user-testable atomic level tasks
   - Create a git branch for each task with an appropriate name
   - Implement the task
   - Commit the work to the branch
   - Ask the user to verify the task outcome
   - If the task is verified as incomplete or has bugs, iterate over the development
   - If the task passes verification:
     - Checkout the main branch
     - Do a pull request to merge to main
     - If the merge is successful, delete the branch
     - Return to orchestrator with verification

## Communication

1. **ALWAYS ask clarifying questions - never assume.**
   - When requirements are ambiguous, seek clarification
   - Confirm understanding before proceeding with implementation
# Workspace Rules

## Automated Git Commit & Push Workflow
After completing code changes for any user request, automatically run the following three git commands sequentially at the end of the task before delivering the final response:
1. `git add .`
2. `git commit -m "<clear, specific message describing the changes>"`
3. `git push origin main`
4. Confirm success by displaying the output of `git log --oneline -3`.

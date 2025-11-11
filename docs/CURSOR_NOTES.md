# Cursor Notes

## Style Guidelines

1. **Keep % symbol for percentages** - Use "80%" not "80 percent"
2. **No em dashes** - Use periods or semicolons instead
3. **Avoid contractions** in code comments and UI text
4. **Build each prompt independently** - Run tests before the next prompt

## Examples

**Good:**

```javascript
// Reduce volume by 30% for game day taper
// This action cannot be undone
const message = 'Low readiness. Reducing volume 30%.';
```

**Bad:**

```javascript
// Reduce volume by 30% for game day taper (no issues, just preference)
// You can't undo this action (contraction)
const message = 'Low readiness. Reducing volume 30%';
```

# CLAUDE.md — Polythm Development Guidelines

## JavaScript Best Practices

These guidelines are based on the Airbnb, Google, and MDN JavaScript style guides.

### Variables & Declarations

- Use `const` by default; use `let` only when reassignment is necessary; never use `var`
- Declare one variable per statement
- Name variables and functions with `camelCase`, classes with `PascalCase`, module-level constants with `UPPER_SNAKE_CASE`
- Use descriptive names — avoid single letters, abbreviations, or Hungarian notation

### Code Style

- 2-space indentation
- Single quotes for strings; template literals for interpolation
- Always include semicolons
- Always use braces for control structures (`if`, `for`, `while`), even for single-line bodies
- Opening brace on the same line (K&R style); `else` on the same line as the closing `}`
- Max line length: 100 characters
- Strict equality always: `===` / `!==`; never `==` / `!=`

### Functions

- Prefer named function declarations for top-level functions
- Use arrow functions for callbacks and closures
- Place default parameters last
- Do not mutate function parameters

### Arrays & Objects

- Use literals (`[]`, `{}`) not constructors
- Use destructuring to extract properties and array elements
- Use spread (`...`) instead of `Object.assign` for shallow copies
- Use shorthand property and method syntax
- Prefer `.map()`, `.filter()`, `.reduce()` over manual `for` loops

### Async Patterns

- Prefer `async`/`await` over raw promise chains
- Always handle rejection: `try/catch` with `async`/`await`, or `.catch()` on promise chains
- Use `Promise.all()` for independent parallel operations

### Error Handling

- Always throw `Error` instances or subclasses — never throw plain strings
- Use `try/catch` for recoverable errors
- Log errors with `console.error()`; use `console.log()` only for informational output
- Leave an explanatory comment inside intentionally empty `catch` blocks

### Modules

- Use ES module syntax (`import` / `export`)
- Group all imports at the top of the file, before any implementation code
- Avoid circular dependencies

### DOM & Web APIs

- Prefer `.textContent` over `.innerHTML` when inserting plain text
- Use `querySelector` / `querySelectorAll` over legacy methods
- Batch DOM mutations; avoid layout thrashing
- Remove event listeners when their associated elements are removed
- Never use `eval()` or the `Function()` constructor with dynamic strings
- Do not modify built-in prototypes

### Comments

- Comment the *why*, not the *what* — avoid restating what the code already says
- Use `//` for single-line comments placed on the line above the code they describe
- Use JSDoc (`/** ... */`) for exported functions and classes

### Testing

- Write testable code: minimize global state and tight coupling
- Test error paths, not just happy paths
- Mock external dependencies (network, timers, audio context)
- Co-locate test files with source or place them in a `test/` directory

### Tooling

- Enforce style with **ESLint**; format with **Prettier**
- Run lint checks before committing

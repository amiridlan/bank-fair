# Diagrams

Four diagrams, each answering one question. Mermaid source, so GitHub renders them in place and a change that contradicts one shows up in the same diff.

| File | Answers |
|---|---|
| [`01-architecture.md`](01-architecture.md) | What is this made of, and what changes when Laravel arrives? |
| [`02-write-request.md`](02-write-request.md) | What happens between a click and a changed record? |
| [`03-data-model.md`](03-data-model.md) | What is stored, and how do the records relate? |
| [`04-lifecycles.md`](04-lifecycles.md) | What states does a record pass through — and where there is no lifecycle, what is checked instead? |

Each one ends with what it deliberately leaves out and what it cannot show. Those notes carry the caveats; the pictures only carry the shape.

## Keeping them honest

They were derived by reading the code, not by describing it from memory, and every block was rendered before being committed. Two things they got wrong on the first pass and which are worth re-checking on any edit: the table count, and whether the employer pipeline has a transition table. It does not — see `04-lifecycles.md`.

**`03-data-model.md` is the volatile one.** Any change to a model in `src/app/core/models/` can invalidate it. The other three change at the pace of the architecture, which is to say rarely.

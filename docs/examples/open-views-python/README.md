# A fluid Open Views provider in Python, from GT `@gtView` views

This example serves Python objects to fluid through the [Open Views](../../architecture/OPEN-VIEWS.md)
protocol. The views are plain **Glamorous Toolkit Remote Phlow** code: the `@gtView` decorator and the
view builder come from the real [`gtoolkit_bridge`](https://pypi.org/project/gtoolkit-bridge/) package.
An adapter translates GT's view specifications into Open Views nodes. A class written for GT's inspector
shows the same views in fluid, with no change.

| File | Role |
|---|---|
| [`domain.py`](domain.py) | the inspected objects (`ModuleInspection`, `ClassInspection`) and their `@gtView` methods; ids |
| [`phlow_adapter.py`](phlow_adapter.py) | GT `GtPhlow…ViewSpecification` → Open Views `ViewNode`, paged items |
| [`server.py`](server.py) | the HTTP routes (`http.server`), CORS, errors |

```python
from gtoolkit_bridge import gtView

class ModuleInspection:
    @gtView
    def gtViewClasses(self, builder):
        return builder.columnedList() \
            .title("Classes") \
            .priority(10) \
            .items(lambda: self.classes()) \
            .column("Class", lambda each: each.cls.__qualname__)
```

## Phlow views and Open Views nodes

| GT view (builder call) | `viewName` in GT's export | Open Views node |
|---|---|---|
| `list()` + `items`, `itemFormat` | `GtPhlowListViewSpecification` | `list`: 50 items, `total`, the rest paged |
| `columnedList()` + `items`, `column` | `GtPhlowColumnedListViewSpecification` | `columnedList`: same paging |
| `columnedTree()` + `items`, `column`, `children` | `GtPhlowColumnedTreeViewSpecification` | `tree`, `lazy`: roots and children from the items route |
| `textEditor()` + `setString` | `GtPhlowTextEditorViewSpecification` | `text` (`language` when the view sets one) |
| `forward()` + `object`, `view` | `GtPhlowForwardViewSpecification` | `forward` to the object's id and view |
| `empty()` | `GtPhlowEmptyViewSpecification` | not listed |
| a view method that raises | `GtPhlowViewErrorViewSpecification` | `unsupported`, with the error as `message` |

The view `key` is the method name (`gtViewClasses`), and `title` and `priority` are GT's. The generic
views GT adds to every object (`Raw`, `Methods`, `Print`) come along too.

## The domain

Objects are Python modules and classes of one package, the **scope**. The ids are
`module:<name>` (e.g. `module:http.client`) and `class:<module>:<qualified name>` (e.g.
`class:http.client:HTTPException`). Any other id, such as the GraphQL id of an item fluid shows,
opens the default module. That way the views show up next to any GraphQL source.

- module: **Classes** (columned list), **Submodules** (list, packages only), **Source** (text);
- class: **Subclasses** (lazy tree), **Methods** (columned list), **Source** (text), **Module** (forward
  to its module's Classes).

Remote Phlow in Python has no actions, so the server gives every view two: `refresh` and `print`.

## Run it

```bash
cd docs/examples/open-views-python
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python server.py              # default module http.client, scope http
.venv/bin/python server.py json         # another default module (and scope)
```

`PORT=9000 …` picks another port (default 8091). The server listens on `127.0.0.1`. CORS allows fluid's
dev server, `http://localhost:5173` and `http://127.0.0.1:5173` (`ALLOWED_ORIGINS` in `server.py`).

## Try it

```bash
B=localhost:8091 C=class:http.client:HTTPException
curl -s $B/.well-known/fluid-views
# {"protocol": "fluid-views", "version": 1, "name": "Python (GT @gtView)", "capabilities": {"actions": true}}
curl -s $B/objects/module:http.client/views                 # Classes (10), Source (20), Raw (200), …
curl -s $B/objects/module:http.client/views/gtViewClasses   # columnedList: first 50 classes, total
curl -s "$B/objects/module:http.client/views/gtViewClasses/items?path=0&offset=2&limit=3"
curl -s $B/objects/$C/views/gtViewSubclasses                # tree, lazy
curl -s "$B/objects/$C/views/gtViewSubclasses/items?path=0"    # root: HTTPException
curl -s "$B/objects/$C/views/gtViewSubclasses/items?path=0.0"  # its 9 subclasses
curl -s $B/objects/$C/views/gtViewModule                    # forward to module:http.client
curl -s -X POST $B/objects/module:http.client/views/gtViewSource/actions/print
curl -s $B/objects/module:os/views                          # 404 object-not-found (out of scope)
```

The answers validate against [`open-views.schema.json`](../../architecture/open-views.schema.json) and
the zod schemas of `@fluid/shared` (`packages/shared/src/openViews/protocol.ts`).

## See it in fluid

1. Run fluid locally (`pnpm dev`) on any GraphQL source.
2. In **Settings → Plugins → Open Views**, add `http://localhost:8091` to the endpoints (one per line).
3. Open an item in a detail column: its perspectives list **Classes**, **Source**, **Raw**, … of the
   default module.

## What Open Views lacks for Phlow

- **Spawning an object.** In GT, selecting an item opens that item in the next pane. In Open Views, a
  `ref` names an object of the GraphQL source, so the items here carry no ref. Only `forward` reaches
  another object of the provider.
- **Actions** are per view, without Phlow's action kinds (button, toggle, dropdown) or arguments.
- **Cell styling** (GT's `background`, `cellWidth`) and the text view's styling have no equivalent.

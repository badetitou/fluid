"""Translates GT Remote Phlow views (gtoolkit_bridge) into fluid Open Views documents.

The view list and each view's title, priority and kind come from GT itself: `GtViewedObject`
finds the @gtView methods and `asDictionaryForExport()` gives the `GtPhlow…ViewSpecification`
dictionary GT's inspector reads. Items are computed from the live view (its `items`,
`column`, `itemFormat` and `children` callbacks), one page at a time.

Protocol: docs/architecture/OPEN-VIEWS.md. Every view has one pageable node at most, so the
first index of an items `path` is always 0; in a tree the next indices walk roots, then children.
"""

from gtoolkit_bridge import GtViewedObject

FIRST_PAGE = 50  # items sent with a list or columned list; the rest come from the items route


class ViewNotFound(Exception):
    pass


class BadPath(Exception):
    pass


def _text(callback, item):
    try:
        return str(callback(item))
    except Exception as error:  # a failing cell shows its error, as in GT
        return f"Error: {error}"


def _views(obj):
    """The non-empty Phlow views of an object, as (key, view, export dictionary)."""
    viewed = GtViewedObject(obj)
    found = []
    for key in sorted(viewed.getGtViewMethodNames()):
        try:
            view = viewed.getView(key)
            export = view.asDictionaryForExport()
        except Exception:
            export = viewed.getViewDeclaration(key)  # GT turns the error into an error view
            view = None
        if export.get("viewName") != "GtPhlowEmptyViewSpecification":
            found.append((key, view, export))
    return found


def declarations(obj):
    """`views` of the object views response, by priority."""
    found = [{"key": key, "title": export.get("title", key), "priority": export.get("priority", 1)}
             for key, _, export in _views(obj)]
    return sorted(found, key=lambda view: view["priority"])


def _find(obj, key):
    for found_key, view, export in _views(obj):
        if found_key == key:
            return view, export
    raise ViewNotFound(key)


def _cells(view, export, item):
    if export["viewName"] == "GtPhlowListViewSpecification":
        return [{"text": _text(view.itemsFormatCallback, item)}]
    return [{"text": _text(column.formatItem, item)} for column in view.columns]


def _children(view, item):
    try:
        return list(view.childrenComputation(item))
    except Exception:
        return []


def _item(view, export, item):
    result = {"cells": _cells(view, export, item)}
    if export["viewName"] == "GtPhlowColumnedTreeViewSpecification" and _children(view, item):
        result["hasChildren"] = True  # no `children`: fluid asks for them when the item unfolds
    return result


def _node(view, export, domain):
    """The Open Views node of one Phlow view."""
    name = export.get("viewName")
    columns = [{"title": c["title"]} for c in export.get("columnSpecifications", [])]
    if name == "GtPhlowListViewSpecification" or name == "GtPhlowColumnedListViewSpecification":
        rows = list(view.itemsCallback())
        node = {"kind": "list"} if name == "GtPhlowListViewSpecification" else {"kind": "columnedList", "columns": columns}
        return {**node, "items": [_item(view, export, r) for r in rows[:FIRST_PAGE]], "total": len(rows)}
    if name == "GtPhlowColumnedTreeViewSpecification":
        return {"kind": "tree", "columns": columns, "roots": [], "lazy": True}
    if name == "GtPhlowTextEditorViewSpecification":
        language = getattr(view, "language", None)
        return {"kind": "text", "text": export.get("string", ""), **({"language": language} if language else {})}
    if name == "GtPhlowForwardViewSpecification":
        target = domain.id_of(view.getForwardObject())
        if target is None:
            return {"kind": "unsupported", "type": name, "message": "The forwarded object has no id."}
        forwarded = view.getForwardView()
        return {"kind": "forward", "ref": {"id": target}, **({"view": forwarded} if forwarded else {})}
    message = export.get("errorMessage")
    return {"kind": "unsupported", "type": name or "unknown", **({"message": message} if message else {})}


def view_response(obj, key, domain):
    """`GET …/views/<key>` without `actions`: the declaration and the node."""
    view, export = _find(obj, key)
    node = _node(view, export, domain)
    return {"key": key, "title": export.get("title", key), "priority": export.get("priority", 1), "view": node}


def items_page(obj, key, path, offset, limit):
    """`GET …/views/<key>/items`: a slice of the items (or tree children) that `path` names."""
    view, export = _find(obj, key)
    indices = [int(i) for i in path.split(".")]
    pageable = ("GtPhlowListViewSpecification", "GtPhlowColumnedListViewSpecification", "GtPhlowColumnedTreeViewSpecification")
    if view is None or indices[0] != 0 or export["viewName"] not in pageable:
        raise BadPath(path)
    level = list(view.itemsCallback())
    if len(indices) > 1 and export["viewName"] != "GtPhlowColumnedTreeViewSpecification":
        raise BadPath(path)
    for index in indices[1:]:
        if index >= len(level):
            raise BadPath(path)
        level = _children(view, level[index])
    return {"items": [_item(view, export, i) for i in level[offset:offset + limit]], "total": len(level)}

"""The inspected domain: Python modules and classes, with GT-style @gtView methods.

These classes are plain Glamorous Toolkit (Remote Phlow) code: the same decorator, the same
builder calls. Inside GT they show the same views in the inspector.

Object ids are stable strings: `module:<dotted name>` and `class:<module>:<qualified name>`.
Only modules of one package (the scope) can be opened, so a request can never import
arbitrary code.
"""

import importlib
import inspect
import pkgutil

from gtoolkit_bridge import gtView


def _source(obj):
    try:
        return inspect.getsource(obj)
    except (OSError, TypeError):
        return f"# No Python source for {obj!r} (built-in or C extension)"


class ModuleInspection:
    """A module: its classes, its submodules and its source."""

    def __init__(self, module):
        self.module = module

    def __str__(self):
        return f"module {self.module.__name__}"

    def classes(self):
        name = self.module.__name__
        found = [c for _, c in inspect.getmembers(self.module, inspect.isclass) if c.__module__ == name]
        return [ClassInspection(c) for c in found]

    def submodules(self):
        path = getattr(self.module, "__path__", None)
        if path is None:
            return []
        return sorted(f"{self.module.__name__}.{info.name}" for info in pkgutil.iter_modules(path))

    @gtView
    def gtViewClasses(self, builder):
        return builder.columnedList() \
            .title("Classes") \
            .priority(10) \
            .items(lambda: self.classes()) \
            .column("Class", lambda each: each.cls.__qualname__) \
            .column("Bases", lambda each: ", ".join(b.__name__ for b in each.cls.__bases__)) \
            .column("Subclasses", lambda each: str(len(each.cls.__subclasses__())))

    @gtView
    def gtViewSubmodules(self, builder):
        if not hasattr(self.module, "__path__"):
            return builder.empty()
        return builder.list() \
            .title("Submodules") \
            .priority(15) \
            .items(lambda: self.submodules()) \
            .itemFormat(lambda each: each)

    @gtView
    def gtViewSource(self, builder):
        view = builder.textEditor() \
            .title("Source") \
            .priority(20) \
            .setString(_source(self.module))
        view.language = "python"  # not part of GT's API: an optional hint read by the adapter
        return view


class ClassInspection:
    """A class: its subclasses (a lazy tree), its methods, its source and its module."""

    def __init__(self, cls):
        self.cls = cls

    def __str__(self):
        return f"class {self.cls.__module__}.{self.cls.__qualname__}"

    def methods(self):
        own = vars(self.cls)
        return sorted((n, v) for n, v in own.items() if inspect.isfunction(v) or isinstance(v, (classmethod, staticmethod)))

    @gtView
    def gtViewSubclasses(self, builder):
        return builder.columnedTree() \
            .title("Subclasses") \
            .priority(10) \
            .items(lambda: [self.cls]) \
            .children(lambda each: sorted(each.__subclasses__(), key=lambda c: c.__qualname__)) \
            .column("Class", lambda each: each.__qualname__) \
            .column("Module", lambda each: each.__module__)

    @gtView
    def gtViewMethods(self, builder):
        return builder.columnedList() \
            .title("Methods") \
            .priority(20) \
            .items(lambda: self.methods()) \
            .column("Method", lambda each: each[0]) \
            .column("Kind", lambda each: type(each[1]).__name__)

    @gtView
    def gtViewSource(self, builder):
        view = builder.textEditor() \
            .title("Source") \
            .priority(30) \
            .setString(_source(self.cls))
        view.language = "python"
        return view

    @gtView
    def gtViewModule(self, builder):
        return builder.forward() \
            .title("Module") \
            .priority(40) \
            .object(lambda: ModuleInspection(importlib.import_module(self.cls.__module__))) \
            .view("gtViewClasses")


class Domain:
    """Turns ids into inspected objects and back, within one package (the scope)."""

    def __init__(self, default_module):
        self.default_id = f"module:{default_module}"
        self.scope = default_module.split(".")[0]

    def in_scope(self, module_name):
        return module_name == self.scope or module_name.startswith(self.scope + ".")

    def resolve(self, object_id):
        """The object an id names, or None. Any other id (e.g. a GraphQL id from fluid) gets the default module."""
        kind, _, rest = object_id.partition(":")
        if kind not in ("module", "class"):
            return self.resolve(self.default_id)
        module_name, _, qualname = rest.partition(":")
        if not self.in_scope(module_name) or (kind == "class") != bool(qualname):
            return None
        try:
            target = importlib.import_module(module_name)
        except ImportError:
            return None
        if kind == "module":
            return ModuleInspection(target)
        for part in qualname.split("."):
            target = getattr(target, part, None)
        return ClassInspection(target) if inspect.isclass(target) else None

    def id_of(self, obj):
        """The stable id of an inspected object, or None when it has none."""
        if isinstance(obj, ModuleInspection):
            return f"module:{obj.module.__name__}"
        if isinstance(obj, ClassInspection) and self.in_scope(obj.cls.__module__):
            return f"class:{obj.cls.__module__}:{obj.cls.__qualname__}"
        return None

    @staticmethod
    def describe(obj):
        """The `type` and `label` of an object in the views response."""
        if isinstance(obj, ModuleInspection):
            return "PythonModule", obj.module.__name__
        return "PythonClass", obj.cls.__qualname__

"""Edit the hand-formatted JSON files in data/ by path, without re-dumping them (the layout stays as written).

A path is keys and list indexes joined by "/": "entries/0/items/2/ru", "classes/3/src/pve".

    find   <file> <text> [--lang ru]     paths of string values that contain <text> (case-insensitive)
    get    <file> <path>                 print the value at path (JSON)
    set    <file> <path> <json>          replace the value at path (<json> is a JSON literal: '"text"', 3, '{...}')
    set    <file> --from <values.json>   replace many: {"path": value, ...} (good for long texts and translations)
    add    <file> <path> <key> <json>    add "key": value right after the value at <path> (same line), e.g. "tr" after "uk"
    insert <file> <list path> <index> <json> [--indent N]   insert a list item before <index>, on its own line
    rep    <file> <old> <new>            replace a whole string value everywhere it occurs (exact match)
    dump   <file> [--lang ru]            print every string of one language, numbered, with its path
    numfix <file> ... [--lang ru]        4-digit numbers with a space ("1 600") -> "1600" in one language's strings

From Python: sys.path.insert(0, "tools"); from jedit import set_values, insert_after, insert_item, replace_strings
"""
import io
import json
import re
import sys

_dec = json.JSONDecoder()
_WS = re.compile(r"\s*")


def read(fn):
    return io.open(fn, encoding="utf-8").read()


def write(fn, s):
    json.loads(s)  # never write a broken file
    io.open(fn, "w", encoding="utf-8", newline="").write(s)


def spans(s):
    """{path: (start, end)} of every value in the JSON text s."""
    out = {}

    def scan(i, path):
        i = _WS.match(s, i).end()
        c = s[i]
        if c == "{":
            i += 1
            while True:
                i = _WS.match(s, i).end()
                if s[i] == "}":
                    return i + 1
                k, i = _dec.raw_decode(s, i)
                i = _WS.match(s, i).end() + 1  # the colon
                vs = _WS.match(s, i).end()
                p = f"{path}/{k}" if path else k
                i = scan(vs, p)
                out[p] = (vs, i)
                i = _WS.match(s, i).end()
                if s[i] == ",":
                    i += 1
        if c == "[":
            i += 1
            n = 0
            while True:
                i = _WS.match(s, i).end()
                if s[i] == "]":
                    return i + 1
                vs = i
                p = f"{path}/{n}"
                i = scan(i, p)
                out[p] = (vs, i)
                n += 1
                i = _WS.match(s, i).end()
                if s[i] == ",":
                    i += 1
        _, i = _dec.raw_decode(s, i)
        return i

    scan(0, "")
    return out


def dumps(val):
    return json.dumps(val, ensure_ascii=False)


def set_values(fn, values):
    """values: {path: new value}."""
    s = read(fn)
    for path, val in values.items():
        sp = spans(s)
        if path not in sp:
            raise KeyError(f"{fn}: no path {path}")
        a, b = sp[path]
        s = s[:a] + dumps(val) + s[b:]
    write(fn, s)


def insert_after(fn, path, key, val):
    s = read(fn)
    a, b = spans(s)[path]
    s = s[:b] + f", {dumps(key)}: {dumps(val)}" + s[b:]
    write(fn, s)


def insert_item(fn, list_path, index, val, indent=None):
    """Insert val into the list at list_path before position index, on its own line."""
    s = read(fn)
    a, b = spans(s)[f"{list_path}/{index}"]
    if indent is None:
        indent = a - s.rfind("\n", 0, a) - 1
    text = dumps(val)
    if isinstance(val, (dict, list)) and "\n" in s[a:b]:  # the neighbour is spread over lines: do the same
        text = json.dumps(val, ensure_ascii=False, indent=2).replace("\n", "\n" + " " * indent)
    s = s[:a] + text + ",\n" + " " * indent + s[a:]
    write(fn, s)


def replace_strings(fn, pairs):
    """pairs: [(old, new)] - whole string values, exact match; every old must exist."""
    s = read(fn)
    for old, new in pairs:
        ea = dumps(old)
        if ea not in s:
            raise KeyError(f"{fn}: string not found: {old[:60]}")
        s = s.replace(ea, dumps(new))
    write(fn, s)


def strings(data, lang=None, path=""):
    """[(path, text)] of string values; with lang, only values under that language key
    (in i18n.json: the strings of data[lang])."""
    out = []
    if isinstance(data, dict):
        for k, v in data.items():
            p = f"{path}/{k}" if path else k
            if lang and k == lang and isinstance(v, str):
                out.append((p, v))
            elif lang and k == lang and isinstance(v, dict) and not path:  # i18n.json block
                out += strings(v, None, p)
            elif lang and k == lang and isinstance(v, list):
                out += [(f"{p}/{i}", x) for i, x in enumerate(v) if isinstance(x, str)]
            else:
                out += strings(v, lang, p)
    elif isinstance(data, list):
        for i, v in enumerate(data):
            out += strings(v, lang, f"{path}/{i}")
    elif isinstance(data, str) and not lang:
        out.append((path, data))
    return out


_NUM = re.compile(r"(?<![\d,.])(?<!\d )(\d) (\d{3})(?!\d)(?! \d{3})")


def numfix(fn, lang="ru"):
    s = read(fn)
    vals = {v for _, v in strings(json.loads(s), lang) if _NUM.search(v)}
    n = 0
    for v in vals:
        a, b = dumps(v), dumps(_NUM.sub(r"\1\2", v))
        n += s.count(a)
        s = s.replace(a, b)
    write(fn, s)
    return n


def _opt(args, name, default=None):
    if name in args:
        i = args.index(name)
        val = args[i + 1]
        del args[i:i + 2]
        return val
    return default


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__)
        return
    lang = _opt(args, "--lang")
    cmd, fn = args[0], args[1]
    if cmd == "find":
        q = args[2].lower()
        for p, v in strings(json.loads(read(fn)), lang):
            if q in v.lower():
                print(f"{p}\t{v[:100]}")
    elif cmd == "get":
        d = json.loads(read(fn))
        for k in args[2].split("/"):
            d = d[int(k)] if isinstance(d, list) else d[k]
        print(json.dumps(d, ensure_ascii=False, indent=1))
    elif cmd == "set":
        src = _opt(args, "--from")
        if src:
            set_values(fn, json.loads(read(src)))
        else:
            set_values(fn, {args[2]: json.loads(args[3])})
    elif cmd == "add":
        insert_after(fn, args[2], args[3], json.loads(args[4]))
    elif cmd == "insert":
        ind = _opt(args, "--indent")
        insert_item(fn, args[2], int(args[3]), json.loads(args[4]), int(ind) if ind else None)
    elif cmd == "rep":
        replace_strings(fn, [(args[2], args[3])])
    elif cmd == "dump":
        for i, (p, v) in enumerate(strings(json.loads(read(fn)), lang), 1):
            print(f"{i} | {p} | {v}")
    elif cmd == "numfix":
        for f in args[1:]:
            print(f, numfix(f, lang or "ru"))
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()

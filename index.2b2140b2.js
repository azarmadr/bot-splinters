var ConsoleLogHTML = function(e1, t1, n1, o1, r1, i1, l1) {
    for(var f1 = 0; f1 < t1.length; f1++)r1 !== typeof n1[t1[f1]] && (e1[t1[f1]] = n1[t1[f1]]);
    var c1 = n1.skipHtml, a1 = o1.keys(e1), s1 = r1 !== typeof n1.clear && n1.clear, u1 = typeof jQuery !== r1 && jQuery, p = function() {
        for(var e, t, n = {
        }, r = 0; r < arguments.length; r++)for(t = o1.keys(arguments[r]), e = 0; e < t.length; e++)n[t[e]] = arguments[r][t[e]];
        return n;
    }, d = function(t, o, r, i, f, c) {
        n1.skipHtml[t] = function() {
            e1[t].apply(n1, arguments);
        }, n1[t] = function() {
            var e, a, s, u;
            for(e = "", s = 0; s < arguments.length; s++){
                if (a = arguments[s] + "", a === l1) try {
                    a = "Object " + JSON.stringify(arguments[s]);
                } catch (e2) {
                }
                e += (s > 0 ? " " : "") + a;
            }
            e = (i ? "[" + (new Date).toLocaleTimeString() + "] " : "") + e, u = document.createElement("li"), u.setAttribute("data-level", t), u.innerText = e, r[t] && u.setAttribute("class", r[t]), c ? o.appendChild(u) : o.insertBefore(u, o.firstChild), f && n1.skipHtml[t].apply(n1, arguments);
        };
    };
    return {
        DEFAULTS: {
            error: "text-danger",
            warn: "text-warning",
            info: "text-success",
            debug: "text-info",
            log: ""
        },
        disconnect: function() {
            n1.skipHtml = c1;
            for(var t = 0; t < a1.length; t++)n1[a1[t]] = e1[a1[t]];
            !1 !== s1 && (n1.clear = s1);
        },
        connect: function(e, t, o, r, l) {
            if (u1 && e instanceof u1 && (e = e[0]), typeof r !== i1 && (r = !0), typeof o !== i1 && (o = !0), !(e instanceof HTMLUListElement)) throw new Error("The target must be a HTML <ul> element");
            t = p(ConsoleLogHTML.DEFAULTS, t || {
            }), n1.skipHtml = {
            };
            for(var f = 0; f < a1.length; f++)d(a1[f], e, t, o, r, l);
            !1 !== s1 && (n1.clear = function() {
                e.innerText = "", s1.apply(n1);
            });
        }
    };
}({
}, [
    "log",
    "debug",
    "info",
    "warn",
    "error"
], console, Object, "undefined", "boolean", "[object Object]");
"undefined" != typeof module && "undefined" != typeof module.exports && (module.exports = ConsoleLogHTML);

//# sourceMappingURL=index.2b2140b2.js.map

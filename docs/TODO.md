## CLI

`erf [path]` - runs all analyses, produces report with advice - identifying dead code, the 5 largest files etc.
`erf -f [filename]` - runs analyses, saves report to file, default `erf-report.md`
`erf -r [filename]` - run analyses, saves dependency tree etc as Turtle RDF, default file `erf.ttl`
`erf -e entrypoint` - entrypoint is the name of a file to use as starting point, trace critical paths
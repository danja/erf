#! /bin/sh

# Count lines of code filtered by .gitignore 
# with key semweb formats added to language definitions
 
cloc --vcs=git --read-lang-def=cloc-lang-defs.txt .
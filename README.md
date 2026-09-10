# lib
Library CrootJS

## Coding Conventions (Mandatory)

Projects using CrootJS must keep HTML, CSS, and JS in separate files, and load JS as `<script type="module">` — no inline `<style>`/`<script>` blocks or `onclick`/`style=""` attributes. Full rules: https://croot.js.org/docs/conventions

Using an AI coding agent? Drop [`CLAUDE.md`](CLAUDE.md) (in this repo) into your project root — Claude Code picks it up automatically.

## Release Tag
```sh
git tag                                 #check current version
git tag v0.0.3                          #set tag version
git push origin --tags                  #push tag version to repo
```

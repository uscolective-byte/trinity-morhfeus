# Trinity MCP developer tools

The `developer_tools` MCP tool exposes the Local Gateway's reviewed npm tool
catalog to project-control clients. All project operations are restricted to
`Trinity/workspace/projects/<project-name>`; packages are pinned to an exact
version and installed with npm lifecycle scripts disabled.

Supported operations:

- `catalog`: list reviewed tools.
- `inspect`: check whether a catalog tool is installed in a project.
- `create`: create a new, empty project scaffold.
- `install`: install one catalog tool at an exact version.
- `execute`: run a supported version, check, build, or test command.

Catalog and inspect requests are read actions. Create, install, and execute
requests produce a proposed `run` action and require the existing Trinity
approval flow. After submitting any operation, poll `get_project_action` with
the returned action ID to retrieve its verified Local Gateway receipt.
Without an authorized project-control MCP identity and a connected Local
Gateway, these operations cannot access a PC or execute.

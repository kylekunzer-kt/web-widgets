# Multi text filter

Filter Data Grid 2 rows by multiple search terms at once. A row matches when **any** term
matches **any** of the selected attributes.

## Features

- Enter terms one at a time, or paste a comma-, newline-, or tab-separated list
- Each term appears as a removable chip
- Search across several attributes at once
- Choose how terms match: contains, equal, or starts with

## Usage

1. Place the widget in a Data grid 2 column header or in the grid's header.
2. Under **Attributes**, select the string attributes to search.
3. Optionally change **Match mode** and **Maximum terms**.

## Limitations

- Attributes must be selected explicitly; there is no automatic column mode.
- Each term adds one condition per selected attribute. With a database datasource, a large
  number of terms produces a large query and will slow down. **Maximum terms** (default 100)
  bounds this. For lookups of many hundreds of values, a microflow datasource with an OQL
  `in` clause performs far better than a client-side filter.
- Terms cannot contain a comma, tab, or newline — those characters split the term.

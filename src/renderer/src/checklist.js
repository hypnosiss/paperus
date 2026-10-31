const KEY = 'completedTasksAtBottom'
let enabled = false

export async function loadChecklistPreference() {
  try { enabled = await window.api.getSettings(KEY) === true }
  catch { enabled = false }
}
export function completedTasksAtBottom() { return enabled }
export async function setCompletedTasksAtBottom(value) {
  await window.api.setSettings(KEY, !!value)
  enabled = !!value
}

const TASK = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\](?:\s|$)/
const indent = line => (line.match(/^[ \t]*/)?.[0] || '').replace(/\t/g, '    ').length

// One checkbox action, scoped to its contiguous sibling checklist. Nested
// content travels with its parent; headings/blank lines split separate lists.
export function checkboxChange(text, position, done, sort = enabled) {
  const lines = text.split('\n')
  let index = 0, offset = 0
  while (index < lines.length - 1 && offset + lines[index].length < position) {
    offset += lines[index++].length + 1
  }
  const match = TASK.exec(lines[index])
  if (!match) return null
  const box = lines[index].indexOf('[', match[1].length) + 1
  if (!sort) return { from: offset + box, to: offset + box + 1, insert: done ? 'x' : ' ' }
  const depth = indent(lines[index])
  let start = index
  for (let i = index - 1; i >= 0; i--) {
    if (!lines[i].trim()) break
    if (indent(lines[i]) > depth) continue
    if (indent(lines[i]) === depth && TASK.test(lines[i])) start = i
    else break
  }
  const blocks = []
  let end = start
  while (end < lines.length && indent(lines[end]) === depth && TASK.test(lines[end])) {
    const first = end++
    while (end < lines.length && lines[end].trim() && indent(lines[end]) > depth) end++
    const block = lines.slice(first, end)
    if (first === index) block[0] = block[0].slice(0, box) + (done ? 'x' : ' ') + block[0].slice(box + 1)
    blocks.push({ lines: block, done: TASK.exec(block[0])[2] !== ' ' })
  }
  const sorted = [...blocks.filter(b => !b.done), ...blocks.filter(b => b.done)]
  const before = lines.slice(start, end).join('\n')
  const after = sorted.flatMap(b => b.lines).join('\n')
  // Keep unchanged CRDT characters intact rather than replacing the document.
  let prefix = 0, suffix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++
  const from = lines.slice(0, start).reduce((n, line) => n + line.length + 1, 0)
  return { from: from + prefix, to: from + before.length - suffix, insert: after.slice(prefix, after.length - suffix) }
}

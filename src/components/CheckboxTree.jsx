// frontend/src/components/CheckboxTree.jsx
import { useMemo, useRef, useEffect } from 'react'

/**
 * CheckboxTree
 * Props:
 * - items: Array of { id: string|number, label: string, children?: items[] }
 * - checkedIds: (Array) controlled selection (ids)
 * - onChange: (nextIds: Array) => void
 * - disabledIds?: Array|Set of ids to disable (optional)
 * - className?: string (optional)
 */
export default function CheckboxTree({
  items = [],
  checkedIds = [],
  onChange,
  disabledIds = [],
  className = ''
}) {
  const disabledSet = useMemo(() => new Set(disabledIds), [disabledIds])

  const collectIds = (node) => [
    node.id,
    ...(node.children ? node.children.flatMap(collectIds) : [])
  ]

  const toggleMany = (ids) => {
    const next = new Set(checkedIds)
    const allSelected = ids.every((id) => next.has(id))
    ids.forEach((id) => {
      if (allSelected) next.delete(id)
      else next.add(id)
    })
    onChange(Array.from(next))
  }

  const Node = ({ node }) => {
    const branchIds = useMemo(() => collectIds(node), [node])
    const hasChildren = node.children && node.children.length > 0

    const checkedCount = branchIds.reduce(
      (acc, id) => acc + (checkedIds.includes(id) ? 1 : 0),
      0
    )
    const allChecked = checkedCount === branchIds.length && branchIds.length > 0
    const someChecked = checkedCount > 0 && !allChecked

    const boxRef = useRef(null)
    useEffect(() => {
      if (boxRef.current) boxRef.current.indeterminate = someChecked
    }, [someChecked])

    const disabled = disabledSet.has(node.id)

    return (
      <li className="space-y-2">
        <label
          className={`flex items-start gap-2 p-2 rounded-xl border ${
            allChecked ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
          }`}
        >
          <input
            ref={boxRef}
            type="checkbox"
            disabled={disabled}
            checked={allChecked}
            onChange={() => toggleMany(branchIds)}
          />
          <span className="leading-tight">
            <span className="block text-sm font-medium">{node.label}</span>
            {hasChildren && (
              <span className="block text-xs text-gray-500">
                {someChecked
                  ? 'Partially selected'
                  : allChecked
                  ? 'All selected'
                  : 'None selected'}
              </span>
            )}
          </span>
        </label>

        {hasChildren && (
          <ul className="pl-6 border-l space-y-2">
            {node.children.map((child) => (
              <Node key={child.id} node={child} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <ul className={`space-y-3 ${className}`}>
      {items.map((n) => (
        <Node key={n.id} node={n} />
      ))}
    </ul>
  )
}

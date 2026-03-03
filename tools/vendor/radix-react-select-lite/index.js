const React = require("react")

const SelectContext = React.createContext(null)

function useSelectContext() {
  const context = React.useContext(SelectContext)
  if (!context) {
    return {
      value: undefined,
      setValue: () => {},
      open: false,
      setOpen: () => {},
    }
  }
  return context
}

function Root({
  children,
  value: controlledValue,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    Boolean(defaultOpen)
  )

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen

  const setValue = React.useCallback(
    (nextValue) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(nextValue)
      }
      if (typeof onValueChange === "function") {
        onValueChange(nextValue)
      }
    },
    [controlledValue, onValueChange]
  )

  const setOpen = React.useCallback(
    (nextOpen) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen)
      }
      if (typeof onOpenChange === "function") {
        onOpenChange(nextOpen)
      }
    },
    [controlledOpen, onOpenChange]
  )

  const contextValue = React.useMemo(
    () => ({ value, setValue, open, setOpen }),
    [value, setValue, open, setOpen]
  )

  return React.createElement(SelectContext.Provider, { value: contextValue }, children)
}

const Group = React.forwardRef((props, ref) =>
  React.createElement("div", { ref, ...props })
)
Group.displayName = "SelectGroup"

const Value = React.forwardRef(({ children, placeholder, ...props }, ref) => {
  const context = useSelectContext()
  const content =
    children !== undefined && children !== null
      ? children
      : context.value || placeholder || null

  return React.createElement("span", { ref, ...props }, content)
})
Value.displayName = "SelectValue"

const Trigger = React.forwardRef(({ onClick, ...props }, ref) => {
  const context = useSelectContext()

  return React.createElement("button", {
    ref,
    type: "button",
    "aria-haspopup": "listbox",
    "aria-expanded": context.open,
    onClick: (event) => {
      if (typeof onClick === "function") {
        onClick(event)
      }
      if (!event.defaultPrevented) {
        context.setOpen(!context.open)
      }
    },
    ...props,
  })
})
Trigger.displayName = "SelectTrigger"

function Icon({ asChild, children, ...props }) {
  if (asChild && React.isValidElement(children)) {
    return children
  }
  return React.createElement("span", { ...props }, children)
}

const ScrollUpButton = React.forwardRef((props, ref) =>
  React.createElement("button", { ref, type: "button", ...props })
)
ScrollUpButton.displayName = "SelectScrollUpButton"

const ScrollDownButton = React.forwardRef((props, ref) =>
  React.createElement("button", { ref, type: "button", ...props })
)
ScrollDownButton.displayName = "SelectScrollDownButton"

function Portal({ children }) {
  return React.createElement(React.Fragment, null, children)
}

const Content = React.forwardRef(
  ({ children, position, side, ...props }, ref) => {
    const context = useSelectContext()

    if (!context.open) {
      return null
    }

    return React.createElement(
      "div",
      {
        ref,
        role: "listbox",
        "data-position": position,
        "data-side": side,
        "data-state": context.open ? "open" : "closed",
        ...props,
      },
      children
    )
  }
)
Content.displayName = "SelectContent"

const Viewport = React.forwardRef((props, ref) =>
  React.createElement("div", { ref, ...props })
)
Viewport.displayName = "SelectViewport"

const Label = React.forwardRef((props, ref) =>
  React.createElement("div", { ref, ...props })
)
Label.displayName = "SelectLabel"

const ItemContext = React.createContext(null)

const Item = React.forwardRef(
  ({ children, value, disabled, onClick, ...props }, ref) => {
    const context = useSelectContext()

    return React.createElement(
      ItemContext.Provider,
      { value: { selected: context.value === value } },
      React.createElement(
        "div",
        {
          ref,
          role: "option",
          "aria-selected": context.value === value,
          "aria-disabled": disabled || undefined,
          "data-value": value,
          "data-disabled": disabled ? "true" : undefined,
          onClick: (event) => {
            if (typeof onClick === "function") {
              onClick(event)
            }
            if (!event.defaultPrevented && !disabled && value !== undefined) {
              context.setValue(value)
              context.setOpen(false)
            }
          },
          ...props,
        },
        children
      )
    )
  }
)
Item.displayName = "SelectItem"

const ItemIndicator = React.forwardRef((props, ref) => {
  const itemContext = React.useContext(ItemContext)

  if (!itemContext?.selected) {
    return null
  }

  return React.createElement("span", { ref, ...props })
})
ItemIndicator.displayName = "SelectItemIndicator"

const ItemText = React.forwardRef((props, ref) =>
  React.createElement("span", { ref, ...props })
)
ItemText.displayName = "SelectItemText"

const Separator = React.forwardRef((props, ref) =>
  React.createElement("div", { ref, role: "separator", ...props })
)
Separator.displayName = "SelectSeparator"

module.exports = {
  Content,
  Group,
  Icon,
  Item,
  ItemIndicator,
  ItemText,
  Label,
  Portal,
  Root,
  ScrollDownButton,
  ScrollUpButton,
  Separator,
  Trigger,
  Value,
  Viewport,
}

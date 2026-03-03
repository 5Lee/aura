const React = require("react")

const Root = React.forwardRef(
  ({ decorative, orientation = "horizontal", ...props }, ref) =>
    React.createElement("div", {
      ref,
      role: decorative ? undefined : "separator",
      "aria-orientation": orientation,
      "data-orientation": orientation,
      ...props,
    })
)

Root.displayName = "Separator"

module.exports = {
  Root,
}

const React = require("react")

const Root = React.forwardRef((props, ref) =>
  React.createElement("label", { ref, ...props })
)

Root.displayName = "Label"

module.exports = {
  Root,
}

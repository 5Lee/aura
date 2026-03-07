"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input, type InputProps } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PasswordFieldProps = Omit<InputProps, "type"> & {
  containerClassName?: string
}

const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, containerClassName, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className={cn("relative", containerClassName)}>
        <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          onClick={() => setVisible((currentValue) => !currentValue)}
          aria-label={visible ? "隐藏密码" : "显示密码"}
          aria-pressed={visible}
          tabIndex={props.disabled ? -1 : 0}
          disabled={props.disabled}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    )
  }
)

PasswordField.displayName = "PasswordField"

export { PasswordField }

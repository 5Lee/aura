import { InlineNotice, type InlineNoticeTone } from "@/components/ui/inline-notice"

type AuthFormNoticeTone = Exclude<InlineNoticeTone, "success">

type AuthFormNoticeProps = {
  className?: string
  message: string
  tone: AuthFormNoticeTone
}

export function AuthFormNotice({ className, message, tone }: AuthFormNoticeProps) {
  return <InlineNotice className={className} message={message} tone={tone} />
}

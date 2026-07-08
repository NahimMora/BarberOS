"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, Loader2Icon, XIcon } from "lucide-react"

const Combobox = ComboboxPrimitive.Root

function ComboboxInputGroup({
  className,
  ...props
}: ComboboxPrimitive.InputGroup.Props) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      className={cn(
        "relative flex w-full items-center gap-1.5 rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/40 dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg bg-transparent py-2 pr-9 pl-3.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function ComboboxTrailingIcon({
  loading,
  className,
}: {
  loading?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground",
        className
      )}
      aria-hidden="true"
    >
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <ChevronDownIcon className="size-4" />
      )}
    </div>
  )
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      className={cn(
        "absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      <XIcon className="size-4" />
    </ComboboxPrimitive.Clear>
  )
}

function ComboboxPopup({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-popup"
          className={cn(
            "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-52 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/12 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <ComboboxPrimitive.List
            data-slot="combobox-list"
            className="scroll-my-1 p-1"
          >
            {children}
          </ComboboxPrimitive.List>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex min-h-10 w-full cursor-default items-center gap-1.5 rounded-md py-2.5 pr-8 pl-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="flex flex-1 shrink-0 flex-col gap-0.5">{children}</span>
      <ComboboxPrimitive.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn("px-3 py-6 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxInputGroup,
  ComboboxInput,
  ComboboxTrailingIcon,
  ComboboxClear,
  ComboboxPopup,
  ComboboxItem,
  ComboboxEmpty,
}

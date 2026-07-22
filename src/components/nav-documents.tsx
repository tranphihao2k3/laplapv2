"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import {
  type LucideIcon,
} from "lucide-react"

import { isNavActive } from "@/lib/nav-active"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavDocuments({
  items,
}: {
  items: {
    name: string
    url: string
    icon: LucideIcon
    group?: string
  }[]
}) {
  const pathname = usePathname()
  const groupedItems = useMemo(
    () =>
      items.reduce<Record<string, typeof items>>((acc, item) => {
        const key = item.group ?? "Khác"
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      }, {}),
    [items],
  )

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Quản trị nâng cao</SidebarGroupLabel>
      {Object.entries(groupedItems).map(([groupName, groupItems]) => (
        <SidebarMenu key={groupName}>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-xs font-semibold uppercase text-sidebar-foreground/70">
              <span>{groupName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {groupItems.map((item) => {
            const active = isNavActive(pathname, item.url)
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="data-[active=true]:relative data-[active=true]:font-semibold data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1/2 data-[active=true]:before:h-5 data-[active=true]:before:w-1 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-r data-[active=true]:before:bg-primary"
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      ))}
    </SidebarGroup>
  )
}

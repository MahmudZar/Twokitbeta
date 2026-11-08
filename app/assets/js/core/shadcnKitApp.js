/**
 * src/App.tsx of the web app kit (core/shadcnKit.js): a small app shell
 * (sidebar, header, pages) that uses every bundled component, so the theme can
 * be checked at a glance in light and dark. The TSX below avoids template
 * literals so it can live in this one.
 *
 * @module shadcnKitApp
 */

export const appTsx = (name) => `import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  Bell, Bold, CalendarIcon, ChevronsUpDown, CircleCheck, CreditCard, Ellipsis, Inbox, Info, Italic, LayoutDashboard, Layers,
  LogOut, Mail, Monitor, Moon, OctagonX, Palette, Plus, Search, Settings, SquarePen, Sun, Table as TableIcon, Trash2, TriangleAlert, Underline, User,
} from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from "@/components/ui/menubar"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Toaster } from "@/components/ui/sonner"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const APP_NAME = ${JSON.stringify(name)}

type Page = "overview" | "forms" | "overlays" | "states" | "data" | "tokens"

const pages: { id: Page; label: string; icon: typeof Inbox }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "forms", label: "Forms", icon: SquarePen },
  { id: "overlays", label: "Overlays", icon: Layers },
  { id: "states", label: "States", icon: CircleCheck },
  { id: "data", label: "Data", icon: TableIcon },
  { id: "tokens", label: "Tokens", icon: Palette },
]

const invoices = [
  { id: "INV-001", customer: "Ada Lovelace", status: "Paid", amount: "$250.00" },
  { id: "INV-002", customer: "Grace Hopper", status: "Pending", amount: "$150.00" },
  { id: "INV-003", customer: "Alan Turing", status: "Overdue", amount: "$350.00" },
  { id: "INV-004", customer: "Katherine Johnson", status: "Paid", amount: "$450.00" },
]

const visits = [
  { month: "Jan", desktop: 186, mobile: 80 },
  { month: "Feb", desktop: 305, mobile: 200 },
  { month: "Mar", desktop: 237, mobile: 120 },
  { month: "Apr", desktop: 173, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "Jun", desktop: 264, mobile: 140 },
]

const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig

// Whole class names, so Tailwind finds them in the source.
const swatches = [
  ["background", "bg-background"], ["card", "bg-card"], ["popover", "bg-popover"], ["primary", "bg-primary"], ["secondary", "bg-secondary"],
  ["muted", "bg-muted"], ["accent", "bg-accent"], ["destructive", "bg-destructive"], ["border", "bg-border"], ["ring", "bg-ring"],
]
const shadows = [["card", "shadow-card"], ["raised", "shadow-raised"], ["popover", "shadow-popover"], ["dialog", "shadow-dialog"]]
const states = [
  { name: "info", alert: "info", icon: Info, solid: "bg-info text-info-foreground" },
  { name: "success", alert: "success", icon: CircleCheck, solid: "bg-success text-success-foreground" },
  { name: "warning", alert: "warning", icon: TriangleAlert, solid: "bg-warning text-warning-foreground" },
  { name: "error", alert: "destructive", icon: OctagonX, solid: "bg-destructive text-destructive-foreground" },
] as const

function ThemeMenu() {
  const { theme = "system", setTheme } = useTheme()
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme">{theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}</Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AppSidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Layers className="size-4" /></div>
              <div className="grid flex-1 text-left leading-tight"><span className="truncate font-semibold">{APP_NAME}</span><span className="truncate text-xs text-muted-foreground">Design system</span></div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Components</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pages.map((p) => (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton isActive={page === p.id} onClick={() => setPage(p.id)}><p.icon /> {p.label}</SidebarMenuButton>
                  {p.id === "states" && <SidebarMenuBadge>4</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8"><AvatarFallback>AL</AvatarFallback></Avatar>
                  <div className="grid flex-1 text-left leading-tight"><span className="truncate font-medium">Ada Lovelace</span><span className="truncate text-xs text-muted-foreground">ada@example.com</span></div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuItem><User /> Profile</DropdownMenuItem>
                <DropdownMenuItem><CreditCard /> Billing</DropdownMenuItem>
                <DropdownMenuItem><Settings /> Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive"><LogOut /> Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function Overview() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Revenue", "$45,231", 72], ["Subscriptions", "2,350", 48], ["Sales", "12,234", 86], ["Active now", "573", 31]].map(([label, value, progress]) => (
          <Card key={label as string}>
            <CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle><CardAction><Badge variant="secondary">+12%</Badge></CardAction></CardHeader>
            <CardContent><Progress value={progress as number} /></CardContent>
          </Card>
        ))}
      </div>
      <Tabs defaultValue="visits">
        <TabsList><TabsTrigger value="visits">Visits</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="empty">Empty</TabsTrigger></TabsList>
        <TabsContent value="visits">
          <Card>
            <CardHeader><CardTitle>Visits</CardTitle><CardDescription>Chart colors come from TwoKit (chart-1 to chart-5).</CardDescription></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={visits}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
                  <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity" className="flex flex-col gap-3">
          {["New sign-up", "Invoice paid", "Comment on your post"].map((t) => (
            <Item key={t} variant="outline">
              <ItemMedia variant="icon"><Inbox /></ItemMedia>
              <ItemContent><ItemTitle>{t}</ItemTitle><ItemDescription>2 minutes ago</ItemDescription></ItemContent>
              <ItemActions><Button variant="ghost" size="icon-sm" aria-label="More"><Ellipsis /></Button></ItemActions>
            </Item>
          ))}
        </TabsContent>
        <TabsContent value="empty">
          <Card>
            <CardContent>
              <Empty>
                <EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>No projects yet</EmptyTitle><EmptyDescription>Create your first project to get started.</EmptyDescription></EmptyHeader>
                <EmptyContent><Button><Plus /> New project</Button></EmptyContent>
              </Empty>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Forms() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <Card>
        <CardHeader><CardTitle>Create an account</CardTitle><CardDescription>Fields, selects, checkboxes, radios, switches and sliders.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()}>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="first">First name</FieldLabel><Input id="first" placeholder="Ada" /></Field>
                <Field data-invalid><FieldLabel htmlFor="last">Last name</FieldLabel><Input id="last" aria-invalid placeholder="Lovelace" /><FieldError>Last name is required.</FieldError></Field>
              </div>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <InputGroup><InputGroupInput id="email" type="email" placeholder="ada@example.com" /><InputGroupAddon><Mail /></InputGroupAddon></InputGroup>
                <FieldDescription>We never share it.</FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Plan</FieldLabel>
                  <Select defaultValue="pro">
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="team">Team</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="country">Country (native select)</FieldLabel>
                  <NativeSelect id="country" defaultValue="ke"><NativeSelectOption value="ke">Kenya</NativeSelectOption><NativeSelectOption value="us">United States</NativeSelectOption><NativeSelectOption value="de">Germany</NativeSelectOption></NativeSelect>
                </Field>
              </div>
              <Field>
                <FieldLabel>Start date</FieldLabel>
                <Popover>
                  <PopoverTrigger asChild><Button variant="outline" className="w-56 justify-start font-normal"><CalendarIcon /> {date ? date.toLocaleDateString() : "Pick a date"}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={setDate} /></PopoverContent>
                </Popover>
              </Field>
              <Field>
                <FieldLabel>Verification code</FieldLabel>
                <InputOTP maxLength={6}>
                  <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /></InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
                </InputOTP>
              </Field>
              <Field><FieldLabel htmlFor="about">About</FieldLabel><Textarea id="about" placeholder="Tell us a little about yourself" /></Field>
              <FieldSet>
                <FieldLegend variant="label">Billing</FieldLegend>
                <RadioGroup defaultValue="monthly">
                  <Field orientation="horizontal"><RadioGroupItem value="monthly" id="monthly" /><FieldLabel htmlFor="monthly" className="font-normal">Monthly</FieldLabel></Field>
                  <Field orientation="horizontal"><RadioGroupItem value="yearly" id="yearly" /><FieldLabel htmlFor="yearly" className="font-normal">Yearly</FieldLabel></Field>
                </RadioGroup>
              </FieldSet>
              <Field><FieldLabel>Team size</FieldLabel><Slider defaultValue={[30]} max={100} step={1} /></Field>
              <Field orientation="horizontal"><Switch id="news" defaultChecked /><FieldLabel htmlFor="news" className="font-normal">Send me product news</FieldLabel></Field>
              <Field orientation="horizontal"><Checkbox id="terms" /><FieldLabel htmlFor="terms" className="font-normal">I accept the terms</FieldLabel></Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="gap-2"><Button variant="outline">Cancel</Button><Button>Create account</Button></CardFooter>
      </Card>
      <div className="flex flex-col gap-6">
        <Card><CardContent><Calendar mode="single" selected={date} onSelect={setDate} /></CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Text style</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ToggleGroup type="multiple" variant="outline" defaultValue={["bold"]}>
              <ToggleGroupItem value="bold" aria-label="Bold"><Bold /></ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Italic"><Italic /></ToggleGroupItem>
              <ToggleGroupItem value="underline" aria-label="Underline"><Underline /></ToggleGroupItem>
            </ToggleGroup>
            <ButtonGroup><Button variant="outline">Archive</Button><Button variant="outline">Report</Button><Button variant="outline" size="icon" aria-label="More"><Ellipsis /></Button></ButtonGroup>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Overlays() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Popover, tooltip, hover card</CardTitle><CardDescription>Floating surfaces use the popover color and shadow.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild><Button variant="outline">Popover</Button></PopoverTrigger>
            <PopoverContent className="flex flex-col gap-3">
              <p className="text-sm font-medium">Dimensions</p>
              <div className="grid grid-cols-3 items-center gap-2"><Label htmlFor="width">Width</Label><Input id="width" defaultValue="100%" className="col-span-2 h-8" /></div>
              <div className="grid grid-cols-3 items-center gap-2"><Label htmlFor="height">Height</Label><Input id="height" defaultValue="25px" className="col-span-2 h-8" /></div>
            </PopoverContent>
          </Popover>
          <Tooltip><TooltipTrigger asChild><Button variant="secondary">Tooltip</Button></TooltipTrigger><TooltipContent>Add to library</TooltipContent></Tooltip>
          <HoverCard>
            <HoverCardTrigger asChild><Button variant="link">@twokit</Button></HoverCardTrigger>
            <HoverCardContent className="flex gap-3"><Avatar><AvatarFallback>TK</AvatarFallback></Avatar><div className="text-sm"><p className="font-semibold">@twokit</p><p className="text-muted-foreground">Design systems from one source.</p></div></HoverCardContent>
          </HoverCard>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Dialogs</CardTitle><CardDescription>Dialog, alert dialog, sheet and drawer use the dialog shadow.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild><Button variant="outline">Dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Make changes to your profile here.</DialogDescription></DialogHeader>
              <div className="grid gap-3"><Label htmlFor="name">Name</Label><Input id="name" defaultValue="Ada Lovelace" /></div>
              <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button>Save changes</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive">Delete</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete this project?</AlertDialogTitle><AlertDialogDescription>This can't be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction>Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost">Sheet</Button></SheetTrigger>
            <SheetContent><SheetHeader><SheetTitle>Notifications</SheetTitle><SheetDescription>You have 3 unread messages.</SheetDescription></SheetHeader></SheetContent>
          </Sheet>
          <Drawer>
            <DrawerTrigger asChild><Button variant="ghost">Drawer</Button></DrawerTrigger>
            <DrawerContent>
              <DrawerHeader><DrawerTitle>Move goal</DrawerTitle><DrawerDescription>Set your daily activity goal.</DrawerDescription></DrawerHeader>
              <DrawerFooter><Button>Submit</Button><DrawerClose asChild><Button variant="outline">Cancel</Button></DrawerClose></DrawerFooter>
            </DrawerContent>
          </Drawer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Menus</CardTitle><CardDescription>Menubar and right-click menu.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Menubar>
            <MenubarMenu>
              <MenubarTrigger>File</MenubarTrigger>
              <MenubarContent><MenubarItem>New tab <MenubarShortcut>Ctrl T</MenubarShortcut></MenubarItem><MenubarItem>New window</MenubarItem><MenubarSeparator /><MenubarItem>Print</MenubarItem></MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
              <MenubarTrigger>Edit</MenubarTrigger>
              <MenubarContent><MenubarItem>Undo <MenubarShortcut>Ctrl Z</MenubarShortcut></MenubarItem><MenubarItem>Redo</MenubarItem></MenubarContent>
            </MenubarMenu>
          </Menubar>
          <ContextMenu>
            <ContextMenuTrigger className="flex h-20 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">Right-click here</ContextMenuTrigger>
            <ContextMenuContent className="w-48">
              <ContextMenuItem>Back <ContextMenuShortcut>Alt ←</ContextMenuShortcut></ContextMenuItem>
              <ContextMenuItem>Reload</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive"><Trash2 /> Delete</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Accordion & collapsible</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Accordion type="single" collapsible defaultValue="a">
            <AccordionItem value="a"><AccordionTrigger>Is it accessible?</AccordionTrigger><AccordionContent>Yes. It follows the WAI-ARIA pattern.</AccordionContent></AccordionItem>
            <AccordionItem value="b"><AccordionTrigger>Is it styled?</AccordionTrigger><AccordionContent>With your TwoKit tokens.</AccordionContent></AccordionItem>
          </Accordion>
          <Collapsible className="flex flex-col gap-2">
            <div className="flex items-center justify-between"><span className="text-sm font-medium">3 repositories</span><CollapsibleTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Toggle"><ChevronsUpDown /></Button></CollapsibleTrigger></div>
            <div className="rounded-md border px-3 py-2 text-sm">twokit/app</div>
            <CollapsibleContent className="flex flex-col gap-2"><div className="rounded-md border px-3 py-2 text-sm">twokit/plugins</div><div className="rounded-md border px-3 py-2 text-sm">twokit/docs</div></CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Loading</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
          <Spinner />
        </CardContent>
      </Card>
    </div>
  )
}

function States() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader><CardTitle>Alerts</CardTitle><CardDescription>Each state uses its TwoKit surface, border and text color, light and dark.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Alert><Info /><AlertTitle>Default</AlertTitle><AlertDescription>A plain card-colored alert.</AlertDescription></Alert>
          {states.map((s) => (
            <Alert key={s.name} variant={s.alert}><s.icon /><AlertTitle className="capitalize">{s.name}</AlertTitle><AlertDescription>This is the {s.name} state from TwoKit.</AlertDescription></Alert>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Badges, toasts and buttons</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge><Badge variant="secondary">Secondary</Badge><Badge variant="outline">Outline</Badge>
            <Badge variant="info">Info</Badge><Badge variant="success">Success</Badge><Badge variant="warning">Warning</Badge><Badge variant="destructive">Error</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast("Event created", { description: "Sunday, December 3 at 9:00" })}>Toast</Button>
            <Button variant="outline" onClick={() => toast.info("New version available")}>Info toast</Button>
            <Button variant="outline" onClick={() => toast.success("Changes saved")}>Success toast</Button>
            <Button variant="outline" onClick={() => toast.warning("Storage almost full")}>Warning toast</Button>
            <Button variant="outline" onClick={() => toast.error("Payment failed")}>Error toast</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button><Button variant="destructive">Destructive</Button><Button variant="link">Link</Button>
            <Button disabled><Spinner /> Loading</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon-sm" aria-label="Add"><Plus /></Button>
            <Button size="icon" variant="secondary" aria-label="Search"><Search /></Button>
            <Button size="icon-lg" variant="outline" aria-label="Settings"><Settings /></Button>
            <Button size="icon" variant="ghost" aria-label="Notifications"><Bell /></Button>
            <Button size="icon" variant="destructive" aria-label="Delete"><Trash2 /></Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button size="sm"><Mail /> Small</Button><Button size="lg"><Mail /> Large</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {states.map((s) => <div key={s.name} className={"rounded-md px-3 py-1.5 text-sm font-medium capitalize " + s.solid}>{s.name} solid</div>)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Data() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle><CardDescription>Table, badges and pagination.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.id}</TableCell>
                  <TableCell>{inv.customer}</TableCell>
                  <TableCell><Badge variant={inv.status === "Paid" ? "success" : inv.status === "Overdue" ? "destructive" : "warning"}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-right">{inv.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
              <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
              <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
              <PaginationItem><PaginationNext href="#" /></PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader><CardTitle>Releases</CardTitle><CardDescription>Scroll area.</CardDescription></CardHeader>
        <CardContent>
          <ScrollArea className="h-40 rounded-md border">
            <div className="p-4 text-sm">{Array.from({ length: 24 }, (_, i) => <p key={i} className="py-1">v1.{24 - i}.0</p>)}</div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function Tokens() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {swatches.map(([label, bg]) => (
          <div key={label} className="flex flex-col gap-1.5"><div className={"h-14 rounded-md border " + bg} /><span className="text-xs text-muted-foreground">{label}</span></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {shadows.map(([label, shadow]) => (
          <div key={label} className={"flex h-20 items-end rounded-lg bg-card p-3 text-xs text-muted-foreground " + shadow}>shadow-{label}</div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(["light", "dark"] as const).map((mode) => (
          <div key={mode} data-theme={mode} className="flex flex-col gap-3 rounded-lg border bg-background p-4 text-foreground">
            <p className="text-sm text-muted-foreground">data-theme="{mode}" on a section</p>
            <div className="flex flex-wrap gap-2"><Button>Primary</Button><Button variant="outline">Outline</Button><Badge variant="success">Success</Badge></div>
            <Alert variant="destructive"><OctagonX /><AlertTitle>Error</AlertTitle></Alert>
            <Input placeholder="Input" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {["bg-surface-0", "bg-surface-1", "bg-surface-2", "bg-surface-3", "bg-surface-4", "bg-surface-5", "bg-surface-6", "bg-surface-7", "bg-surface-8"].map((c, i) => (
          <div key={c} className={"flex size-16 items-end rounded-md border p-1.5 text-xs text-muted-foreground " + c}>{i}</div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>("overview")
  const [search, setSearch] = useState(false)
  const { setTheme } = useTheme()
  const current = pages.find((p) => p.id === page)!

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearch((open) => !open)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const go = (p: Page) => {
    setPage(p)
    setSearch(false)
  }

  return (
    <SidebarProvider>
      <AppSidebar page={page} setPage={setPage} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block"><BreadcrumbLink href="#">Components</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem><BreadcrumbPage>{current.label}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex-1" />
          <Button variant="outline" className="hidden w-56 justify-start text-muted-foreground sm:flex" onClick={() => setSearch(true)}>
            <Search /> Search…
            <KbdGroup className="ml-auto"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>
          </Button>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-destructive" />
          </Button>
          <ThemeMenu />
        </header>
        <main className="flex flex-col gap-6 p-4 md:p-6">
          <div className="flex flex-col gap-1">
            <h1>{current.label}</h1>
            <p className="text-muted-foreground">shadcn/ui components linked to your TwoKit design system: colors, states, shadows, radius and fonts, light and dark.</p>
          </div>
          {page === "overview" && <Overview />}
          {page === "forms" && <Forms />}
          {page === "overlays" && <Overlays />}
          {page === "states" && <States />}
          {page === "data" && <Data />}
          {page === "tokens" && <Tokens />}
        </main>
      </SidebarInset>

      <CommandDialog open={search} onOpenChange={setSearch}>
        <CommandInput placeholder="Search pages or run a command…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {pages.map((p) => <CommandItem key={p.id} onSelect={() => go(p.id)}><p.icon /> {p.label}</CommandItem>)}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => { setTheme("light"); setSearch(false) }}><Sun /> Light<CommandShortcut>Ctrl L</CommandShortcut></CommandItem>
            <CommandItem onSelect={() => { setTheme("dark"); setSearch(false) }}><Moon /> Dark</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <Toaster richColors />
    </SidebarProvider>
  )
}
`;

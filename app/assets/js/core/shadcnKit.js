/**
 * Web app kit: a React + Tailwind CSS v4 + shadcn/ui starter whose components
 * are linked to the TwoKit tokens (web app only; the plugins don't offer it).
 *
 * shadcn's components only use Tailwind color/radius utilities (bg-primary,
 * border-input, rounded-md…). Those come from `@theme inline`, so the kit
 * points them straight at TwoKit tokens there (--color-primary →
 * var(--btn-primary-bg)) instead of redefining shadcn's own :root names, which
 * would clash with TwoKit's --primary palette, --border and --radius. Light and
 * dark follow TwoKit's switch: light-dark() tokens + data-theme, and Tailwind's
 * dark: variant is redefined to match it.
 *
 * twokit.css ships in public/ and is linked from index.html, outside the CSS
 * build: Tailwind's optimizer (Lightning CSS) rewrites light-dark() into a
 * polyfill that resolves where the token is declared (:root), so a nested
 * data-theme section would keep the page's colors. Linked as is, light-dark()
 * resolves on the element that uses the token, as in the HTML export.
 *
 * The components (data/shadcnComponents.js, MIT) are vendored by
 * scripts/update-shadcn.mjs; `npx shadcn add …` in the exported project adds
 * more with the same theme.
 *
 * @module shadcnKit
 */

/** The npm packages the starter pins (checked together on 2026-11-08). */
const VERSIONS = {
    react: '^19.3.1',
    'react-dom': '^19.3.1',
    'radix-ui': '^1.8.1',
    'class-variance-authority': '^0.7.1',
    cmdk: '^1.1.1',
    'lucide-react': '^1.70.0',
    clsx: '^2.1.1',
    'tailwind-merge': '^3.7.0',
    'tw-animate-css': '^1.4.0',
    tailwindcss: '^4.3.5',
    '@tailwindcss/vite': '^4.3.5',
    vite: '^8.3.6',
    '@vitejs/plugin-react': '^6.2.1',
    typescript: '^5.9.3',
    '@types/react': '^19.3.0',
    '@types/react-dom': '^19.3.0',
    '@types/node': '^24.10.1'
};

/**
 * shadcn color → TwoKit token. One list builds the CSS and the README table.
 * Button colors come from Styling → Buttons, so a shadcn Button looks like a
 * TwoKit button.
 */
export const SHADCN_COLORS = [
    ['background', 'site-bg', 'Page background'],
    ['foreground', 'text-primary', 'Body text'],
    ['card', 'surface-card', 'Card'],
    ['card-foreground', 'text-primary', ''],
    ['popover', 'surface-popover', 'Popover, menus, select'],
    ['popover-foreground', 'text-primary', ''],
    ['primary', 'btn-primary-bg', 'Default button, checked controls'],
    ['primary-foreground', 'btn-primary-text', ''],
    ['secondary', 'btn-secondary-bg', 'Secondary button'],
    ['secondary-foreground', 'btn-secondary-text', ''],
    ['muted', 'surface-raised', 'Tabs list, skeleton, table rows'],
    ['muted-foreground', 'text-muted', 'Descriptions, placeholders'],
    ['accent', 'hover', 'Hover and focus in menus, ghost buttons'],
    ['accent-foreground', 'text-primary', ''],
    ['destructive', 'error-solid', 'Destructive actions, invalid fields'],
    ['destructive-foreground', 'error-on-solid', ''],
    ['border', 'border', 'Borders'],
    ['input', 'border-strong', 'Field borders'],
    ['ring', 'focus-color', 'Focus ring'],
    ['chart-1', 'primary-500', ''],
    ['chart-2', 'info-solid', ''],
    ['chart-3', 'success-solid', ''],
    ['chart-4', 'warning-solid', ''],
    ['chart-5', 'error-solid', ''],
    ['sidebar', 'surface-1', 'Sidebar (npx shadcn add sidebar)'],
    ['sidebar-foreground', 'text-primary', ''],
    ['sidebar-primary', 'action', ''],
    ['sidebar-primary-foreground', 'on-action', ''],
    ['sidebar-accent', 'hover', ''],
    ['sidebar-accent-foreground', 'text-primary', ''],
    ['sidebar-border', 'border', ''],
    ['sidebar-ring', 'focus-color', '']
];

/** Tailwind radius names → TwoKit radius scale (xs and xl share their names). */
const RADII = [['sm', 'radius-s'], ['md', 'radius-m'], ['lg', 'radius-l'], ['2xl', 'radius-xxl']];

const STATES = ['info', 'success', 'warning', 'error'];
const SURFACES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', 'canvas', 'page', 'card', 'raised', 'popover', 'dialog'];

/** Tailwind's dark: variant, matched to where TwoKit turns dark. */
function darkVariant(mode) {
    const dark = '&:where([data-theme="dark"], [data-theme="dark"] *) { @slot; }';
    const notLight = '&:where(:not([data-theme="light"], [data-theme="light"] *)) { @slot; }';
    if (mode === 'dark') return `@custom-variant dark {\n  ${notLight}\n}`;
    if (mode === 'auto') return `@custom-variant dark {\n  ${dark}\n  @media (prefers-color-scheme: dark) {\n    ${notLight}\n  }\n}`;
    return `@custom-variant dark {\n  ${dark}\n}`;
}

/** src/index.css: Tailwind, the TwoKit tokens and the links between them. */
export function indexCss({ name, mode, palettes, headings }) {
    const line = (k, v) => `  --${k}: var(--${v});`;
    const colors = SHADCN_COLORS.map(([k, v]) => line(`color-${k}`, v));
    const states = STATES.flatMap((s) => [
        line(`color-${s}`, `${s}-solid`),
        line(`color-${s}-foreground`, `${s}-on-solid`),
        line(`color-${s}-surface`, `${s}-surface`),
        line(`color-${s}-border`, `${s}-border`),
        line(`color-${s}-text`, `${s}-text`)
    ]);
    const surfaces = SURFACES.map((s) => line(`color-surface-${s}`, `surface-${s}`));
    const shades = palettes.flatMap((p) => p.shades.map((shade) => line(`color-${shade}`, shade)));
    const heading = headings.map((h) => `  ${h.tag} { font-size: var(--${h.token}); }`).join('\n');

    return `/* ${name} · web app theme, generated by TwoKit.
   shadcn/ui components read Tailwind's theme below, and every value points at a
   TwoKit token in public/twokit.css. Change the design in TwoKit, export again
   and replace public/twokit.css: the components follow.

   twokit.css is linked from index.html, not imported here: the CSS build would
   rewrite its light-dark() tokens, and nested data-theme sections would stop
   switching. */

@import "tailwindcss";
@import "tw-animate-css";

/* dark: utilities follow TwoKit's theme switch (data-theme="light|dark" on any element${mode === 'auto' ? ', else the OS' : ''}) */
${darkVariant(mode)}

@theme inline {
  /* shadcn/ui colors */
${colors.join('\n')}

  /* State colors: bg-success, text-warning-text, border-error-border… */
${states.join('\n')}

  /* Surfaces: bg-surface-2, bg-surface-card… */
${surfaces.join('\n')}

  /* Palettes: bg-primary-500, text-info-700… */
${shades.join('\n')}

  /* Radius: rounded-sm/md/lg/2xl (rounded-xs and rounded-xl use TwoKit's own) */
${RADII.map(([k, v]) => line(`radius-${k}`, v)).join('\n')}

  /* Fonts */
  --font-sans: var(--font-body);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-body);
    line-height: var(--text-line-height);
  }
  :where(h1, h2, h3, h4, h5, h6) {
    font-family: var(--font-heading);
    line-height: var(--heading-line-height);
    text-wrap: balance;
  }
${heading}
}

/* Link buttons and badges take TwoKit's link colors (Styling → Buttons → Link):
   primary is a fill color and can be too light for text. */
@layer utilities {
  [data-slot="button"][data-variant="link"],
  [data-slot="badge"][data-variant="link"] {
    color: var(--btn-link-text);
  }
  [data-slot="button"][data-variant="link"]:hover {
    color: var(--btn-link-text-hover);
  }
}
`;
}

/** The demo page: every component in use, so the theme can be checked at a glance. */
const APP_TSX = (name) => `import { useEffect, useState } from "react"
import { Bell, Bold, CircleCheck, CreditCard, Italic, LogOut, Mail, Monitor, Moon, Plus, Search, Settings, Sun, TriangleAlert, Underline, User } from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type Theme = "light" | "dark" | "system"

/** TwoKit switches themes with data-theme on <html> (index.html applies the saved choice before paint). */
function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "system")
  useEffect(() => {
    const root = document.documentElement
    if (theme === "system") {
      root.setAttribute("data-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      localStorage.removeItem("theme")
    } else {
      root.setAttribute("data-theme", theme)
      localStorage.setItem("theme", theme)
    }
  }, [theme])
  return [theme, setTheme] as const
}

const invoices = [
  { id: "INV-001", customer: "Ada Lovelace", status: "Paid", amount: "$250.00" },
  { id: "INV-002", customer: "Grace Hopper", status: "Pending", amount: "$150.00" },
  { id: "INV-003", customer: "Alan Turing", status: "Unpaid", amount: "$350.00" },
  { id: "INV-004", customer: "Katherine Johnson", status: "Paid", amount: "$450.00" },
]

// Whole class names, so Tailwind finds them in the source.
const swatches = [
  ["background", "bg-background"], ["card", "bg-card"], ["popover", "bg-popover"], ["primary", "bg-primary"], ["secondary", "bg-secondary"],
  ["muted", "bg-muted"], ["accent", "bg-accent"], ["destructive", "bg-destructive"], ["border", "bg-border"], ["ring", "bg-ring"],
]

export default function App() {
  const [theme, setTheme] = useTheme()
  const [search, setSearch] = useState(false)

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

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <span className="font-semibold">${name.replace(/[{}<>`$\\]/g, '')}</span>
          <div className="flex-1" />
          <Button variant="outline" className="w-56 justify-start text-muted-foreground" onClick={() => setSearch(true)}>
            <Search /> Search…
            <KbdGroup className="ml-auto"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Theme">
                {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label="Account">
                <Avatar><AvatarFallback>TK</AvatarFallback></Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuItem><User /> Profile</DropdownMenuItem>
              <DropdownMenuItem><CreditCard /> Billing</DropdownMenuItem>
              <DropdownMenuItem><Settings /> Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive"><LogOut /> Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandDialog open={search} onOpenChange={setSearch}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem><Mail /> Inbox</CommandItem>
            <CommandItem><Bell /> Notifications</CommandItem>
            <CommandItem><Plus /> New project<CommandShortcut>Ctrl N</CommandShortcut></CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => { setTheme("light"); setSearch(false) }}><Sun /> Light</CommandItem>
            <CommandItem onSelect={() => { setTheme("dark"); setSearch(false) }}><Moon /> Dark</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
        <section className="flex flex-col gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Components</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1>Components</h1>
          <p className="max-w-2xl text-muted-foreground">shadcn/ui components linked to your TwoKit design system: colors, surfaces, radius and fonts all come from twokit.css, in light and dark.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled><Spinner /> Loading</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge className="bg-success text-success-foreground">Success</Badge>
            <Badge className="bg-warning text-warning-foreground">Warning</Badge>
            <Badge className="bg-info text-info-foreground">Info</Badge>
          </div>
        </section>

        <Tabs defaultValue="overlays">
          <TabsList>
            <TabsTrigger value="overlays">Overlays</TabsTrigger>
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
          </TabsList>

          <TabsContent value="overlays" className="grid gap-4 pt-2 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Popover & tooltip</CardTitle><CardDescription>Floating surfaces use the popover color.</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild><Button variant="outline">Open popover</Button></PopoverTrigger>
                  <PopoverContent className="flex flex-col gap-3">
                    <p className="text-sm font-medium">Dimensions</p>
                    <div className="grid grid-cols-3 items-center gap-2"><Label htmlFor="width">Width</Label><Input id="width" defaultValue="100%" className="col-span-2 h-8" /></div>
                    <div className="grid grid-cols-3 items-center gap-2"><Label htmlFor="height">Height</Label><Input id="height" defaultValue="25px" className="col-span-2 h-8" /></div>
                  </PopoverContent>
                </Popover>
                <Tooltip>
                  <TooltipTrigger asChild><Button variant="secondary">Hover me</Button></TooltipTrigger>
                  <TooltipContent>Add to library</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Dialogs</CardTitle><CardDescription>Dialog, alert dialog and sheet.</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Dialog>
                  <DialogTrigger asChild><Button variant="outline">Edit profile</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Make changes to your profile here.</DialogDescription></DialogHeader>
                    <div className="grid gap-3"><Label htmlFor="name">Name</Label><Input id="name" defaultValue="Ada Lovelace" /></div>
                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button>Save changes</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="destructive">Delete</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This can't be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction>Continue</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Sheet>
                  <SheetTrigger asChild><Button variant="ghost">Open sheet</Button></SheetTrigger>
                  <SheetContent>
                    <SheetHeader><SheetTitle>Notifications</SheetTitle><SheetDescription>You have 3 unread messages.</SheetDescription></SheetHeader>
                  </SheetContent>
                </Sheet>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Toggles</CardTitle><CardDescription>Toggle group and keyboard keys.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ToggleGroup type="multiple" variant="outline" defaultValue={["bold"]}>
                  <ToggleGroupItem value="bold" aria-label="Bold"><Bold /></ToggleGroupItem>
                  <ToggleGroupItem value="italic" aria-label="Italic"><Italic /></ToggleGroupItem>
                  <ToggleGroupItem value="underline" aria-label="Underline"><Underline /></ToggleGroupItem>
                </ToggleGroup>
                <p className="text-sm text-muted-foreground">Press <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> to search.</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                <Alert><CircleCheck /><AlertTitle>Saved</AlertTitle><AlertDescription>Your changes are live.</AlertDescription></Alert>
                <Alert variant="destructive"><TriangleAlert /><AlertTitle>Payment failed</AlertTitle><AlertDescription>Check your card details and try again.</AlertDescription></Alert>
                <Alert className="border-warning-border bg-warning-surface text-warning-text"><TriangleAlert /><AlertTitle>Heads up</AlertTitle><AlertDescription className="text-warning-text">State colors come from TwoKit too.</AlertDescription></Alert>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Accordion</CardTitle></CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue="a">
                  <AccordionItem value="a"><AccordionTrigger>Is it accessible?</AccordionTrigger><AccordionContent>Yes. It follows the WAI-ARIA pattern.</AccordionContent></AccordionItem>
                  <AccordionItem value="b"><AccordionTrigger>Is it styled?</AccordionTrigger><AccordionContent>With your TwoKit tokens.</AccordionContent></AccordionItem>
                </Accordion>
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
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Scroll area</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-32 rounded-md border">
                  <div className="p-4 text-sm">
                    {Array.from({ length: 20 }, (_, i) => <p key={i} className="py-1">v1.{20 - i}.0</p>)}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="form" className="pt-2">
            <Card className="max-w-2xl">
              <CardHeader><CardTitle>Create an account</CardTitle><CardDescription>Fields, selects, checkboxes, radios, switches and sliders.</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={(e) => e.preventDefault()}>
                  <FieldGroup>
                    <Field><FieldLabel htmlFor="full-name">Full name</FieldLabel><Input id="full-name" placeholder="Ada Lovelace" /></Field>
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <InputGroup>
                        <InputGroupInput id="email" type="email" placeholder="ada@example.com" />
                        <InputGroupAddon><Mail /></InputGroupAddon>
                      </InputGroup>
                      <FieldDescription>We never share it.</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel>Plan</FieldLabel>
                      <Select defaultValue="pro">
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                        </SelectContent>
                      </Select>
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
          </TabsContent>

          <TabsContent value="data" className="flex flex-col gap-4 pt-2">
            <Card>
              <CardHeader><CardTitle>Invoices</CardTitle><CardDescription>Table and pagination.</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.id}</TableCell>
                        <TableCell>{inv.customer}</TableCell>
                        <TableCell><Badge variant={inv.status === "Paid" ? "secondary" : inv.status === "Unpaid" ? "destructive" : "outline"}>{inv.status}</Badge></TableCell>
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
          </TabsContent>

          <TabsContent value="tokens" className="flex flex-col gap-6 pt-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {swatches.map(([name, bg]) => (
                <div key={name} className="flex flex-col gap-1.5">
                  <div className={\`h-14 rounded-md border \${bg}\`} />
                  <span className="text-xs text-muted-foreground">{name}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              {(["light", "dark"] as const).map((mode) => (
                <div key={mode} data-theme={mode} className="flex flex-col gap-3 rounded-lg border bg-background p-4 text-foreground">
                  <p className="text-sm text-muted-foreground">data-theme="{mode}" on a section</p>
                  <div className="flex flex-wrap gap-2"><Button>Primary</Button><Button variant="outline">Outline</Button><Badge variant="secondary">Badge</Badge></div>
                  <Input placeholder="Input" />
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {["0", "1", "2", "3", "4", "5", "6", "7", "8"].map((n) => (
                <div key={n} className="flex size-16 items-end rounded-md border p-1.5 text-xs text-muted-foreground" style={{ background: \`var(--surface-\${n})\` }}>{n}</div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </TooltipProvider>
  )
}
`;

const README = ({ name, folder, fonts, components }) => `# ${name} · web app kit

A React + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) starter, generated by TwoKit.
Every component is linked to your TwoKit design system: colors, surfaces, radius,
fonts and light/dark all come from \`public/twokit.css\`.

## Run it

\`\`\`bash
cd "${folder}"
npm install
npm run dev
\`\`\`

\`src/App.tsx\` shows every component (Ctrl/Cmd K opens the search). Replace it with your app.

## What's inside

\`\`\`
public/twokit.css      your TwoKit tokens (same as variables.css in the HTML & CSS export), linked in index.html
src/index.css          Tailwind + the links from shadcn/Tailwind names to TwoKit tokens
src/components/ui/     ${components.length} shadcn/ui components
src/lib/utils.ts       cn() helper
components.json        shadcn CLI settings${fonts ? '\npublic/fonts.css      @font-face rules, files in public/fonts/' : ''}
\`\`\`

Components: ${components.join(', ')}.

## Update the design

Change it in TwoKit, export again and replace \`public/twokit.css\` (and \`src/index.css\` if you
added palettes). The components follow, nothing else to change.

## More components

\`\`\`bash
npx shadcn@latest add calendar chart sidebar
\`\`\`

They use the same theme: \`components.json\` points the CLI at \`src/index.css\`. If the CLI adds
\`:root\` variables to \`src/index.css\` (some blocks do), delete the ones TwoKit already links below.

## Light and dark

TwoKit switches with \`data-theme="light|dark"\` on \`<html>\` or on any element, and Tailwind's
\`dark:\` variant follows it. With next-themes use \`<ThemeProvider attribute="data-theme">\`.

## How the components are linked

| shadcn / Tailwind | TwoKit token | Used for |
|---|---|---|
${SHADCN_COLORS.map(([k, v, use]) => `| \`${k}\` | \`--${v}\` | ${use} |`).join('\n')}
| \`rounded-sm/md/lg/2xl\` | \`--radius-s/m/l/xxl\` | Radius |
| \`font-sans\` | \`--font-body\` | Body font; headings use \`--font-heading\` |
| Button / Badge \`variant="link"\` | \`--btn-link-text\`, \`--btn-link-text-hover\` | Link text |

Extra utilities: \`bg-success\`, \`text-warning-text\`, \`bg-info-surface\`, \`border-error-border\`,
\`bg-surface-0…8\`, \`bg-surface-card\`, and every palette shade (\`bg-primary-500\`).

## Use it in an existing project

Copy \`public/twokit.css\` and link it in your page, \`src/index.css\` (or its \`@custom-variant\`, \`@theme inline\` and
\`@layer base\` parts into your globals.css), \`src/lib/utils.ts\` and \`src/components/ui/\`, then
install the packages in \`package.json\` → dependencies.

Keep \`twokit.css\` out of your CSS build (don't \`@import\` it into a Tailwind file): build tools
rewrite its \`light-dark()\` tokens, and then a \`data-theme\` section inside the page keeps the
page's colors. In Next.js put it in \`public/\` and add \`<link rel="stylesheet" href="/twokit.css" />\`
to the root layout's \`<head>\`.

shadcn/ui components: MIT License, Copyright (c) 2023 shadcn.
`;

/**
 * The kit as zip entries under `folder/`.
 * @param {object} o
 * @param {string} o.name        project name
 * @param {string} o.folder      folder name in the zip
 * @param {string} o.slug        npm package name
 * @param {string} o.variablesCss TwoKit's variables.css
 * @param {'light'|'dark'|'auto'} o.mode default theme
 * @param {{shades: string[]}[]} o.palettes palette shade token names
 * @param {{tag: string, token: string}[]} o.headings heading size tokens
 * @param {{fontsCss: string, files: {path: string, content: Uint8Array}[]}|null} o.fonts
 * @param {{components: Record<string,string>, packages: string[], style: string}} o.shadcn
 */
export function buildShadcnKit({ name, folder, slug, variablesCss, mode, palettes, headings, fonts, shadcn }) {
    const deps = ['react', 'react-dom', ...shadcn.packages, 'clsx', 'tailwind-merge', 'tw-animate-css', 'tailwindcss', '@tailwindcss/vite'];
    const pick = (list) => Object.fromEntries([...new Set(list)].sort().map((p) => [p, VERSIONS[p] || 'latest']));
    const html = mode === 'auto' ? '' : ` data-theme="${mode === 'dark' ? 'dark' : 'light'}"`;
    const components = Object.keys(shadcn.components);

    const files = [
        ['package.json', `${JSON.stringify({
            name: slug,
            private: true,
            version: '0.1.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview', typecheck: 'tsc --noEmit' },
            dependencies: pick(deps),
            devDependencies: pick(['vite', '@vitejs/plugin-react', 'typescript', '@types/react', '@types/react-dom', '@types/node'])
        }, null, 2)}\n`],
        ['index.html', `<!doctype html>
<html lang="en"${html}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name.replace(/[<>&]/g, '')}</title>
${fonts ? '    <link rel="stylesheet" href="/fonts.css" />\n' : ''}    <!-- TwoKit tokens, as is (not through the CSS build: see src/index.css) -->
    <link rel="stylesheet" href="/twokit.css" />
    <script>
      // The saved theme before the first paint (no flash). Without one, TwoKit's default applies.
      try { var t = localStorage.getItem("theme"); if (t) document.documentElement.setAttribute("data-theme", t); } catch (e) {}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`],
        ['vite.config.ts', `import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
})
`],
        ['tsconfig.json', `${JSON.stringify({
            compilerOptions: {
                target: 'ES2022',
                lib: ['ES2022', 'DOM', 'DOM.Iterable'],
                module: 'ESNext',
                moduleResolution: 'bundler',
                jsx: 'react-jsx',
                strict: true,
                skipLibCheck: true,
                noEmit: true,
                isolatedModules: true,
                resolveJsonModule: true,
                types: ['vite/client', 'node'],
                paths: { '@/*': ['./src/*'] }
            },
            include: ['src', 'vite.config.ts']
        }, null, 2)}\n`],
        ['components.json', `${JSON.stringify({
            $schema: 'https://ui.shadcn.com/schema.json',
            style: 'new-york',
            rsc: false,
            tsx: true,
            tailwind: { config: '', css: 'src/index.css', baseColor: 'neutral', cssVariables: true, prefix: '' },
            iconLibrary: 'lucide',
            aliases: { components: '@/components', utils: '@/lib/utils', ui: '@/components/ui', lib: '@/lib', hooks: '@/hooks' }
        }, null, 2)}\n`],
        ['.gitignore', 'node_modules\ndist\n*.log\n.DS_Store\n'],
        ['README.md', README({ name, folder, fonts: !!fonts, components })],
        ['src/main.tsx', `import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
`],
        ['src/App.tsx', APP_TSX(name)],
        ['src/index.css', indexCss({ name, mode, palettes, headings })],
        ['public/twokit.css', variablesCss],
        ['src/lib/utils.ts', `import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`],
        ...components.map((c) => [`src/components/ui/${c}.tsx`, shadcn.components[c]])
    ].map(([path, content]) => ({ path, content }));

    if (fonts) {
        files.push({ path: 'public/fonts.css', content: fonts.fontsCss });
        for (const f of fonts.files) files.push({ path: `public/fonts/${f.path}`, content: f.content });
    }
    return files.map((f) => ({ ...f, path: `${folder}/${f.path}` }));
}

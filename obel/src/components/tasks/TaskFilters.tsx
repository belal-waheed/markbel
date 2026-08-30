import { Search, ListFilter, TagIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TaskFiltersProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filterStatus: string
  setFilterStatus: (status: string) => void
  allTags: string[]
}

export function TaskFilters({
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  allTags,
}: TaskFiltersProps) {
  return (
    <div className="bg-card/40 backdrop-blur-xl border border-border/80 rounded-[2rem] p-4 shadow-sm relative overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent dark:from-white/5 opacity-50 pointer-events-none" />
      
      <div className="relative flex flex-col md:flex-row flex-wrap items-center gap-4 z-10">
        <div className="relative flex-1 min-w-[280px] w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search tasks..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="pl-11 h-12 bg-background/50 border-border/50 rounded-2xl shadow-inner-sm text-base focus-visible:ring-primary/30" 
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-background/50 border border-border/50 text-muted-foreground shrink-0">
             <ListFilter className="w-5 h-5" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? 'all')}>
            <SelectTrigger className="w-full md:w-[150px] h-12 rounded-2xl bg-background/50 border-border/50 text-base font-medium">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/50 bg-card/95 backdrop-blur-xl">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {allTags.length > 0 && (
        <div className="relative flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-border/30 z-10">
          <TagIcon className="w-4 h-4 text-muted-foreground mr-1" />
          {allTags.map((tag) => (
            <Badge 
              key={tag} 
              variant="secondary" 
              className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                searchQuery === tag 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105' 
                  : 'bg-background/50 hover:bg-primary/20 text-muted-foreground hover:text-foreground'
              }`} 
              onClick={() => setSearchQuery(searchQuery === tag ? '' : tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

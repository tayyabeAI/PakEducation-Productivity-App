import { useState, useEffect, useMemo } from 'react';
import { db, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp, onSnapshot, doc, deleteDoc, or, and } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { TeamDataRecord, UserProfile, ReportTemplate, FilterGroup, FilterCondition } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Filter, 
  Plus, 
  Trash2, 
  Download, 
  Save, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Columns, 
  FileSpreadsheet, 
  FileText, 
  FileCode,
  X,
  Copy,
  LayoutGrid,
  Settings2,
  Calendar,
  ArrowUpDown,
  GripVertical,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Maximize2,
  Users,
  Shield,
  Eye,
  Edit3
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface AdvancedGridViewProps {
  teamId: string;
  members: UserProfile[];
}

export default function AdvancedGridView({ teamId, members }: AdvancedGridViewProps) {
  const { user } = useAuth();
  const [records, setRecords] = useState<TeamDataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
  
  // Filter State
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({
    logic: 'AND',
    conditions: []
  });
  
  // Grid State
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // UI State
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('grid');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isLeadOrAdmin = user?.role === 'lead' || user?.role === 'admin' || user?.role === 'super-admin';

  // Fetch Data
  useEffect(() => {
    if (!teamId || !user) return;
    
    setLoading(true);
    
    let q;
    if (isLeadOrAdmin) {
      q = query(collection(db, 'team_data'), where('teamId', '==', teamId));
    } else {
      // Members can only see their assigned or unassigned records, or where they have explicit access
      q = query(
        collection(db, 'team_data'), 
        and(
          where('teamId', '==', teamId),
          or(
            where('assignedUserId', '==', user.uid),
            where('assignedUserIds', 'array-contains', user.uid),
            where('editorIds', 'array-contains', user.uid),
            where('viewerIds', 'array-contains', user.uid),
            where('assignedUserId', '==', null)
          )
        )
      );
    }
    
    const unsub = onSnapshot(q, (snapshot) => {
      let allRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TeamDataRecord));
      
      // Apply Role-Based Filtering
      if (!isLeadOrAdmin) {
        allRecords = allRecords.filter(r => r.assignedUserId === user?.uid || !r.assignedUserId);
      }

      setRecords(allRecords);
      
      // Initialize visible columns if empty
      if (visibleColumns.length === 0 && allRecords.length > 0) {
        const headers = Array.from(new Set(allRecords.flatMap(r => Object.keys(r.dataFields)))) as string[];
        setVisibleColumns(['sheetName', 'status', 'assignedUserIds', ...headers.slice(0, 7)]);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'team_data');
      setLoading(false);
    });

    // Fetch Templates
    const templatesQuery = query(collection(db, 'report_templates'), where('teamId', '==', teamId));
    const unsubTemplates = onSnapshot(templatesQuery, (snapshot) => {
      setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ReportTemplate)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'report_templates');
    });

    return () => {
      unsub();
      unsubTemplates();
    };
  }, [teamId, user?.uid]);

  // Derived Data: All possible headers
  const allHeaders = useMemo(() => {
    const headers = new Set<string>(['sheetName', 'status', 'assignedUserId', 'assignedUserIds', 'editorIds', 'viewerIds', 'createdAt']);
    records.forEach(r => {
      Object.keys(r.dataFields).forEach(h => headers.add(h));
    });
    return Array.from(headers);
  }, [records]);

  // Filter Logic
  const applyFilters = (record: TeamDataRecord, group: FilterGroup): boolean => {
    if (group.conditions.length === 0) return true;

    const results = group.conditions.map(cond => {
      if ('logic' in cond) {
        return applyFilters(record, cond as FilterGroup);
      }
      
      const c = cond as FilterCondition;
      const val = getFieldValue(record, c.field);
      
      switch (c.operator) {
        case 'equals': return String(val).toLowerCase() === String(c.value).toLowerCase();
        case 'not-equals': return String(val).toLowerCase() !== String(c.value).toLowerCase();
        case 'contains': return String(val).toLowerCase().includes(String(c.value).toLowerCase());
        case 'greater-than': return Number(val) > Number(c.value);
        case 'less-than': return Number(val) < Number(c.value);
        case 'between': {
          const numVal = Number(val);
          const start = Number(c.value);
          const end = Number(c.valueEnd);
          if (!isNaN(numVal)) return numVal >= start && numVal <= end;
          // Date between
          const dateVal = new Date(val).getTime();
          const dateStart = new Date(c.value).getTime();
          const dateEnd = new Date(c.valueEnd).getTime();
          return dateVal >= dateStart && dateVal <= dateEnd;
        }
        default: return true;
      }
    });

    return group.logic === 'AND' 
      ? results.every(r => r === true)
      : results.some(r => r === true);
  };

  const getFieldValue = (record: TeamDataRecord, field: string) => {
    if (field === 'status') return record.status;
    if (field === 'sheetName') return record.sheetName;
    if (field === 'assignedUserId') return record.assignedUserId;
    if (field === 'assignedUserIds') return record.assignedUserIds?.join(', ') || '';
    if (field === 'editorIds') return record.editorIds?.join(', ') || '';
    if (field === 'viewerIds') return record.viewerIds?.join(', ') || '';
    if (field === 'createdAt') return record.createdAt?.toDate ? record.createdAt.toDate().toISOString() : '';
    return record.dataFields[field] || '';
  };

  const filteredAndSortedRecords = useMemo(() => {
    let result = records.filter(r => applyFilters(r, filterGroup));

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(r => 
        JSON.stringify(r.dataFields).toLowerCase().includes(lowerSearch) ||
        r.sheetName.toLowerCase().includes(lowerSearch) ||
        r.status.toLowerCase().includes(lowerSearch)
      );
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = getFieldValue(a, sortConfig.key);
        const bVal = getFieldValue(b, sortConfig.key);
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [records, filterGroup, searchTerm, sortConfig]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRecords.slice(start, start + pageSize);
  }, [filteredAndSortedRecords, currentPage, pageSize]);

  // UI Handlers
  const addCondition = (parentId?: string) => {
    const newCondition: FilterCondition = { 
      id: Math.random().toString(36).substr(2, 9),
      field: allHeaders[0], 
      operator: 'equals', 
      value: '' 
    };
    setFilterGroup(prev => {
      const next = { ...prev };
      next.conditions = [...next.conditions, newCondition];
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setFilterGroup((prev) => {
        const oldIndex = prev.conditions.findIndex((c) => (c as any).id === active.id);
        const newIndex = prev.conditions.findIndex((c) => (c as any).id === over?.id);
        return {
          ...prev,
          conditions: arrayMove(prev.conditions, oldIndex, newIndex),
        };
      });
    }
  };

  const removeCondition = (index: number) => {
    setFilterGroup(prev => {
      const next = { ...prev };
      next.conditions.splice(index, 1);
      return next;
    });
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    setFilterGroup(prev => {
      const next = { ...prev };
      next.conditions[index] = { ...next.conditions[index], ...updates } as FilterCondition;
      return next;
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName || !user) return;
    try {
      await addDoc(collection(db, 'report_templates'), {
        name: templateName,
        teamId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        filters: filterGroup,
        columns: visibleColumns
      });
      toast.success('Template saved successfully');
      setIsSaveDialogOpen(false);
      setTemplateName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'report_templates');
    }
  };

  const loadTemplate = (templateId: string) => {
    if (templateId === 'none') {
      setFilterGroup({ logic: 'AND', conditions: [] });
      return;
    }
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFilterGroup(template.filters);
      setVisibleColumns(template.columns);
      setSelectedTemplateId(templateId);
      toast.info(`Loaded template: ${template.name}`);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'report_templates', id));
      toast.success('Template deleted');
      if (selectedTemplateId === id) setSelectedTemplateId('none');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'report_templates');
    }
  };

  // Export Handlers
  const exportExcel = () => {
    const data = filteredAndSortedRecords.map(r => {
      const row: any = {
        'Sheet Name': r.sheetName,
        'Status': r.status,
        'Assigned To': members.find(m => m.uid === r.assignedUserId)?.displayName || 'Unassigned',
        'Created At': r.createdAt?.toDate ? format(r.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : 'N/A'
      };
      visibleColumns.forEach(col => {
        if (!['sheetName', 'status', 'assignedUserId', 'createdAt'].includes(col)) {
          row[col] = r.dataFields[col] || '';
        }
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `Report_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.text('Advanced Data Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 22);
    doc.text(`Total Records: ${filteredAndSortedRecords.length}`, 14, 27);

    const headers = visibleColumns.map(c => c);
    const data = filteredAndSortedRecords.map(r => visibleColumns.map(c => getFieldValue(r, c)));

    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`Report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  // Chart Generation Logic
  const chartData = useMemo(() => {
    if (filteredAndSortedRecords.length === 0) return { statusData: [], numericCharts: [] };

    // 1. Status Distribution
    const statusCounts: Record<string, number> = {};
    filteredAndSortedRecords.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // 2. Auto-detect numeric columns for Bar/Line charts
    const numericFields = allHeaders.filter(h => {
      if (['status', 'sheetName', 'assignedUserId', 'createdAt'].includes(h)) return false;
      return filteredAndSortedRecords.some(r => !isNaN(Number(r.dataFields[h])) && r.dataFields[h] !== '');
    }).slice(0, 3); // Limit to top 3 numeric fields

    const numericCharts = numericFields.map(field => {
      // Group by status or sheetName for the X axis
      const groupedData: Record<string, number> = {};
      filteredAndSortedRecords.forEach(r => {
        const key = r.status;
        const val = Number(r.dataFields[field]);
        if (!isNaN(val)) {
          groupedData[key] = (groupedData[key] || 0) + val;
        }
      });
      return {
        field,
        data: Object.entries(groupedData).map(([name, value]) => ({ name, value }))
      };
    });

    return { statusData, numericCharts };
  }, [filteredAndSortedRecords, allHeaders]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Quick Summary Stats
  const quickStats = useMemo(() => {
    const stats = {
      status: {} as Record<string, number>,
      assignee: {} as Record<string, number>
    };
    
    filteredAndSortedRecords.forEach(r => {
      stats.status[r.status] = (stats.status[r.status] || 0) + 1;
      
      const assignees = r.assignedUserIds || (r.assignedUserId ? [r.assignedUserId] : []);
      assignees.forEach(uid => {
        const name = members.find(m => m.uid === uid)?.displayName || 'Unknown';
        stats.assignee[name] = (stats.assignee[name] || 0) + 1;
      });
      if (assignees.length === 0) {
        stats.assignee['Unassigned'] = (stats.assignee['Unassigned'] || 0) + 1;
      }
    });
    
    return stats;
  }, [filteredAndSortedRecords, members]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Quick Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              Status Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pb-4">
            {Object.entries(quickStats.status).map(([status, count]) => (
              <Badge key={status} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer" onClick={() => {
                setFilterGroup(prev => ({
                  ...prev,
                  conditions: [...prev.conditions, { id: Math.random().toString(), field: 'status', operator: 'equals', value: status }]
                }));
              }}>
                {status}: {count}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <LayoutGrid className="w-3 h-3" />
              Assignee Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pb-4">
            {Object.entries(quickStats.assignee).map(([name, count]) => (
              <Badge key={name} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer" onClick={() => {
                const uid = members.find(m => m.displayName === name)?.uid;
                if (uid) {
                  setFilterGroup(prev => ({
                    ...prev,
                    conditions: [...prev.conditions, { id: Math.random().toString(), field: 'assignedUserId', operator: 'equals', value: uid }]
                  }));
                }
              }}>
                {name}: {count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Header & Template Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            Advanced Grid View
          </h2>
          <p className="text-sm text-slate-500">Powerful multi-column filtering and reporting engine</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={selectedTemplateId} onValueChange={loadTemplate}>
            <SelectTrigger className="w-full md:w-[250px] bg-white">
              <FileCode className="w-4 h-4 mr-2 text-primary" />
              <SelectValue placeholder="Load Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default (No Template)</SelectItem>
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between group">
                  <SelectItem value={t.id!}>{t.name}</SelectItem>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-500"
                    onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id!); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}>
            <Filter className="w-4 h-4 mr-2" />
            {isFilterPanelOpen ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>
      </div>

      {/* Filter Builder Panel */}
      {isFilterPanelOpen && (
        <Card className="border-none shadow-sm bg-slate-50/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              Filter Builder
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white">
                {filteredAndSortedRecords.length} Results Found
              </Badge>
              <Select 
                value={filterGroup.logic} 
                onValueChange={(v) => setFilterGroup(prev => ({ ...prev, logic: v as 'AND' | 'OR' }))}
              >
                <SelectTrigger className="h-8 w-24 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND</SelectItem>
                  <SelectItem value="OR">OR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={filterGroup.conditions.map((c: any) => c.id || Math.random().toString())}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {filterGroup.conditions.map((cond, idx) => (
                    <SortableFilterItem 
                      key={(cond as any).id || idx}
                      id={(cond as any).id}
                      condition={cond as FilterCondition}
                      index={idx}
                      allHeaders={allHeaders}
                      updateCondition={updateCondition}
                      removeCondition={removeCondition}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => addCondition()} className="rounded-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Condition
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setFilterGroup({ logic: 'AND', conditions: [] })}>
                  Clear All
                </Button>
                <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                  <DialogTrigger render={
                    <Button size="sm" className="rounded-full">
                      <Save className="w-4 h-4 mr-2" />
                      Save as Template
                    </Button>
                  } />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Save Report Template</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Template Name</Label>
                        <Input 
                          placeholder="e.g. Monthly High Value Clients" 
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveTemplate}>Save Template</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-white border">
              <TabsTrigger value="grid" className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Grid View
              </TabsTrigger>
              <TabsTrigger value="charts" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Auto-Charts
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search results..." 
              className="pl-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Popover>
            <PopoverTrigger render={
              <Button variant="outline">
                <Columns className="w-4 h-4 mr-2" />
                Columns
              </Button>
            } />
            <PopoverContent className="w-64 p-0" align="end">
              <div className="p-3 border-b bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase">Toggle Columns</p>
              </div>
              <ScrollArea className="h-72 p-2">
                {allHeaders.map(h => (
                  <div key={h} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-lg">
                    <Checkbox 
                      id={`col-${h}`} 
                      checked={visibleColumns.includes(h)}
                      onCheckedChange={(checked) => {
                        if (checked) setVisibleColumns([...visibleColumns, h]);
                        else setVisibleColumns(visibleColumns.filter(c => c !== h));
                      }}
                    />
                    <Label htmlFor={`col-${h}`} className="text-sm cursor-pointer flex-1">{h}</Label>
                  </div>
                ))}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            } />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>
                <FileText className="w-4 h-4 mr-2 text-red-600" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(filteredAndSortedRecords));
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Report_${format(new Date(), 'yyyyMMdd')}.csv`;
                a.click();
              }}>
                <FileCode className="w-4 h-4 mr-2 text-blue-600" />
                Export to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="grid" className="mt-0">
          {/* Grid Table */}
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    {visibleColumns.map(col => (
                      <TableHead key={col} className="whitespace-nowrap">
                        <button 
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                          onClick={() => setSortConfig({ 
                            key: col, 
                            direction: sortConfig?.key === col && sortConfig.direction === 'asc' ? 'desc' : 'asc' 
                          })}
                        >
                          {col}
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record, idx) => (
                    <TableRow key={record.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      {visibleColumns.map(col => (
                        <TableCell key={col} className="max-w-[200px] truncate text-sm">
                          {col === 'assignedUserId' ? (
                            members.find(m => m.uid === record.assignedUserId)?.displayName || 'Unassigned'
                          ) : col === 'assignedUserIds' ? (
                            <div className="flex -space-x-2 overflow-hidden">
                              {(record.assignedUserIds || []).map(uid => (
                                <div key={uid} title={members.find(m => m.uid === uid)?.displayName}>
                                  <img 
                                    src={members.find(m => m.uid === uid)?.photoURL || `https://ui-avatars.com/api/?name=${members.find(m => m.uid === uid)?.displayName}`} 
                                    className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ))}
                              {(!record.assignedUserIds || record.assignedUserIds.length === 0) && 'None'}
                            </div>
                          ) : col === 'status' ? (
                            <Badge variant="outline" className="capitalize">{record.status}</Badge>
                          ) : col === 'createdAt' ? (
                            record.createdAt?.toDate ? format(record.createdAt.toDate(), 'MMM dd, HH:mm') : 'N/A'
                          ) : (
                            String(getFieldValue(record, col))
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <ManageAccessDialog record={record} members={members} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            <div className="p-4 border-t bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-slate-500">
                Showing {Math.min(filteredAndSortedRecords.length, (currentPage - 1) * pageSize + 1)} to {Math.min(filteredAndSortedRecords.length, currentPage * pageSize)} of {filteredAndSortedRecords.length} records
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, Math.ceil(filteredAndSortedRecords.length / pageSize)))].map((_, i) => (
                    <Button
                      key={i}
                      variant={currentPage === i + 1 ? 'default' : 'outline'}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage >= Math.ceil(filteredAndSortedRecords.length / pageSize)}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Distribution Chart */}
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-primary" />
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Numeric Charts */}
            {chartData.numericCharts.map((chart, idx) => (
              <Card key={idx} className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Total {chart.field} by Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart.data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}

            {filteredAndSortedRecords.length > 0 && (
              <Card className="border-none shadow-sm md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Records Trend (Last 10 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={(() => {
                      const last10Days = [...Array(10)].map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (9 - i));
                        return format(d, 'MMM dd');
                      });
                      const counts: Record<string, number> = {};
                      filteredAndSortedRecords.forEach(r => {
                        if (r.createdAt?.toDate) {
                          const date = format(r.createdAt.toDate(), 'MMM dd');
                          counts[date] = (counts[date] || 0) + 1;
                        }
                      });
                      return last10Days.map(date => ({ name: date, count: counts[date] || 0 }));
                    })()}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ManageAccessDialogProps {
  record: TeamDataRecord;
  members: UserProfile[];
}

function ManageAccessDialog({ record, members }: ManageAccessDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [assignedIds, setAssignedIds] = useState<string[]>(record.assignedUserIds || []);
  const [editorIds, setEditorIds] = useState<string[]>(record.editorIds || []);
  const [viewerIds, setViewerIds] = useState<string[]>(record.viewerIds || []);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!record.id) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'team_data', record.id), {
        assignedUserIds: assignedIds,
        editorIds: editorIds,
        viewerIds: viewerIds,
        updatedAt: serverTimestamp()
      });
      toast.success('Access permissions updated');
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating access:', error);
      toast.error('Failed to update access');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUser = (uid: string, list: string[], setList: (val: string[]) => void) => {
    if (list.includes(uid)) {
      setList(list.filter(id => id !== uid));
    } else {
      setList([...list, uid]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
          <Shield className="w-4 h-4" />
        </Button>
      } />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Manage Access & Permissions
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Assignees */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-primary">
                <Users className="w-4 h-4" />
                Assignees
              </Label>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                {members.map(member => (
                  <div key={member.uid} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md">
                    <Checkbox 
                      id={`assign-${member.uid}`} 
                      checked={assignedIds.includes(member.uid)}
                      onCheckedChange={() => toggleUser(member.uid, assignedIds, setAssignedIds)}
                    />
                    <Label htmlFor={`assign-${member.uid}`} className="text-xs cursor-pointer flex-1 truncate">
                      {member.displayName}
                    </Label>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Editors */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-amber-600">
                <Edit3 className="w-4 h-4" />
                Editors
              </Label>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                {members.map(member => (
                  <div key={member.uid} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md">
                    <Checkbox 
                      id={`edit-${member.uid}`} 
                      checked={editorIds.includes(member.uid)}
                      onCheckedChange={() => toggleUser(member.uid, editorIds, setEditorIds)}
                    />
                    <Label htmlFor={`edit-${member.uid}`} className="text-xs cursor-pointer flex-1 truncate">
                      {member.displayName}
                    </Label>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Viewers */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-blue-600">
                <Eye className="w-4 h-4" />
                Viewers
              </Label>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                {members.map(member => (
                  <div key={member.uid} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md">
                    <Checkbox 
                      id={`view-${member.uid}`} 
                      checked={viewerIds.includes(member.uid)}
                      onCheckedChange={() => toggleUser(member.uid, viewerIds, setViewerIds)}
                    />
                    <Label htmlFor={`view-${member.uid}`} className="text-xs cursor-pointer flex-1 truncate">
                      {member.displayName}
                    </Label>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SortableFilterItemProps {
  id: string;
  condition: FilterCondition;
  index: number;
  allHeaders: string[];
  updateCondition: (index: number, updates: Partial<FilterCondition>) => void;
  removeCondition: (index: number) => void;
}

function SortableFilterItem({ id, condition, index, allHeaders, updateCondition, removeCondition }: SortableFilterItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm animate-in slide-in-from-left-2 duration-300 group"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-50 rounded text-slate-400">
        <GripVertical className="w-4 h-4" />
      </div>

      <Select 
        value={condition.field} 
        onValueChange={(v) => updateCondition(index, { field: v })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allHeaders.map(h => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select 
        value={condition.operator} 
        onValueChange={(v) => updateCondition(index, { operator: v as any })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="equals">Equals</SelectItem>
          <SelectItem value="not-equals">Not Equals</SelectItem>
          <SelectItem value="contains">Contains</SelectItem>
          <SelectItem value="greater-than">Greater Than</SelectItem>
          <SelectItem value="less-than">Less Than</SelectItem>
          <SelectItem value="between">Between</SelectItem>
        </SelectContent>
      </Select>

      {condition.operator === 'between' ? (
        <div className="flex items-center gap-2">
          <Input 
            placeholder="Start" 
            className="w-32" 
            value={condition.value} 
            onChange={(e) => updateCondition(index, { value: e.target.value })}
          />
          <span className="text-slate-400">to</span>
          <Input 
            placeholder="End" 
            className="w-32" 
            value={condition.valueEnd} 
            onChange={(e) => updateCondition(index, { valueEnd: e.target.value })}
          />
        </div>
      ) : (
        <Input 
          placeholder="Value" 
          className="w-48" 
          value={condition.value} 
          onChange={(e) => updateCondition(index, { value: e.target.value })}
        />
      )}

      <Button 
        variant="ghost" 
        size="icon" 
        className="text-red-500 hover:bg-red-50 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => removeCondition(index)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

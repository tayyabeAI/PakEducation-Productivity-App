import { useState, useEffect, useMemo } from 'react';
import { db, collection, query, where, getDocs, orderBy } from '../lib/firebase';
import { TeamDataRecord, UserProfile } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { Download, FileText, Table as TableIcon, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Loader2, Filter, RefreshCw, Plus, Trash2, Search, LayoutDashboard, Database, TrendingUp, CheckCircle2, Clock, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';

interface AdvancedReportingProps {
  teamId: string;
  members: UserProfile[];
  allHeaders: string[];
  allSheets: string[];
}

export default function AdvancedReporting({ teamId, members, allHeaders, allSheets }: AdvancedReportingProps) {
  const [reportData, setReportData] = useState<any[]>([]);
  const [rawRecords, setRawRecords] = useState<TeamDataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [config, setConfig] = useState({
    groupBy: 'status',
    subGroupBy: 'none',
    chartType: 'bar' as 'bar' | 'pie' | 'line' | 'area',
    sheet: 'all',
    status: 'all',
    assignee: 'all'
  });
  const [customFilters, setCustomFilters] = useState<Array<{ field: string, value: string, operator: string }>>([]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const stats = useMemo(() => {
    if (rawRecords.length === 0) return { total: 0, new: 0, inProgress: 0, completed: 0 };
    return {
      total: rawRecords.length,
      new: rawRecords.filter(r => r.status === 'new').length,
      inProgress: rawRecords.filter(r => r.status === 'in-progress').length,
      completed: rawRecords.filter(r => r.status === 'completed').length
    };
  }, [rawRecords]);

  const addCustomFilter = () => {
    setCustomFilters([...customFilters, { field: allHeaders[0] || 'status', value: '', operator: 'contains' }]);
  };

  const removeCustomFilter = (index: number) => {
    setCustomFilters(customFilters.filter((_, i) => i !== index));
  };

  const updateCustomFilter = (index: number, updates: any) => {
    const newFilters = [...customFilters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setCustomFilters(newFilters);
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      let constraints: any[] = [where('teamId', '==', teamId)];
      
      if (config.sheet !== 'all') constraints.push(where('sheetName', '==', config.sheet));
      if (config.status !== 'all') constraints.push(where('status', '==', config.status));
      if (config.assignee !== 'all') {
        if (config.assignee === 'unassigned') {
          constraints.push(where('assignedUserId', '==', null));
        } else {
          constraints.push(where('assignedUserId', '==', config.assignee));
        }
      }

      const q = query(collection(db, 'team_data'), ...constraints, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      let records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TeamDataRecord));

      // Apply Custom Filters Client-Side
      if (customFilters.length > 0) {
        records = records.filter(r => {
          return customFilters.every(f => {
            if (!f.field || !f.value) return true;
            const val = String(getFieldValue(r, f.field)).toLowerCase();
            const searchVal = f.value.toLowerCase();
            
            if (f.operator === 'equals') return val === searchVal;
            if (f.operator === 'contains') return val.includes(searchVal);
            if (f.operator === 'starts') return val.startsWith(searchVal);
            return true;
          });
        });
      }

      setRawRecords(records);

      // Process for Pivot/Chart
      const grouped: Record<string, any> = {};
      
      records.forEach(r => {
        const primaryVal = getFieldValue(r, config.groupBy);
        const secondaryVal = config.subGroupBy !== 'none' ? getFieldValue(r, config.subGroupBy) : 'Total';
        
        if (!grouped[primaryVal]) {
          grouped[primaryVal] = { name: primaryVal, value: 0, subGroups: {} };
        }
        
        grouped[primaryVal].value += 1;
        grouped[primaryVal].subGroups[secondaryVal] = (grouped[primaryVal].subGroups[secondaryVal] || 0) + 1;
      });

      const finalData = Object.values(grouped).map(g => {
        const item: any = { name: g.name, value: g.value };
        Object.entries(g.subGroups).forEach(([subName, subVal]) => {
          item[subName] = subVal;
        });
        return item;
      });

      setReportData(finalData);
      if (finalData.length === 0) toast.info('No data found for the selected filters');
    } catch (error) {
      console.error('Report generation error:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const getFieldValue = (record: TeamDataRecord, field: string) => {
    if (field === 'status') return record.status;
    if (field === 'assignedUserId') {
      return record.assignedUserId ? 
        members.find(m => m.uid === record.assignedUserId)?.displayName || 'Unknown' : 
        'Unassigned';
    }
    if (field === 'sheetName') return record.sheetName || 'Untitled';
    if (field === '_createdAt') {
      const date = record.createdAt?.toDate ? record.createdAt.toDate() : new Date();
      return date.toLocaleDateString();
    }
    return record.dataFields[field] || 'N/A';
  };

  const downloadReport = () => {
    if (reportData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `TeamReport_${new Date().getTime()}.xlsx`);
  };

  const downloadPDF = () => {
    if (reportData.length === 0) return;
    const doc = new jsPDF() as any;
    doc.text("Team Performance Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
    const headers = Object.keys(reportData[0]);
    const body = reportData.map(row => headers.map(h => row[h]));
    doc.autoTable({
      startY: 30,
      head: [headers],
      body: body,
      theme: 'striped',
      headStyles: { fillStyle: [59, 130, 246] }
    });
    doc.save(`TeamReport_${new Date().getTime()}.pdf`);
  };

  const subGroupKeys = Array.from(new Set(reportData.flatMap(d => 
    Object.keys(d).filter(k => k !== 'name' && k !== 'value')
  )));

  useEffect(() => {
    generateReport();
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50/30 overflow-hidden">
      {/* Top Header / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border-b bg-white">
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-4">
          <div className="bg-blue-500 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Total Records</p>
            <p className="text-2xl font-black text-blue-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-4">
          <div className="bg-amber-500 p-2.5 rounded-xl text-white shadow-lg shadow-amber-200">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">New</p>
            <p className="text-2xl font-black text-amber-900">{stats.new}</p>
          </div>
        </div>
        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-center gap-4">
          <div className="bg-indigo-500 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">In Progress</p>
            <p className="text-2xl font-black text-indigo-900">{stats.inProgress}</p>
          </div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-4">
          <div className="bg-emerald-500 p-2.5 rounded-xl text-white shadow-lg shadow-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Completed</p>
            <p className="text-2xl font-black text-emerald-900">{stats.completed}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r bg-white overflow-y-auto"
            >
              <div className="p-4 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuration</h4>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowFilters(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Group By (Rows)</Label>
                    <Select value={config.groupBy} onValueChange={(v) => setConfig({...config, groupBy: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="assignedUserId">Assignee</SelectItem>
                        <SelectItem value="sheetName">Sheet Name</SelectItem>
                        <SelectItem value="_createdAt">Created Date</SelectItem>
                        {allHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Sub-Group (Columns)</Label>
                    <Select value={config.subGroupBy} onValueChange={(v) => setConfig({...config, subGroupBy: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="assignedUserId">Assignee</SelectItem>
                        <SelectItem value="_createdAt">Created Date</SelectItem>
                        {allHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custom Filters</Label>
                    <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={addCustomFilter}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {customFilters.map((f, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 relative group">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 absolute -top-2 -right-2 bg-white border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-full text-red-500"
                          onClick={() => removeCustomFilter(i)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                        <Select value={f.field} onValueChange={(v) => updateCustomFilter(i, { field: v })}>
                          <SelectTrigger className="h-7 text-[10px] bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="status">Status</SelectItem>
                            <SelectItem value="assignedUserId">Assignee</SelectItem>
                            <SelectItem value="sheetName">Sheet Name</SelectItem>
                            <SelectItem value="_createdAt">Created Date</SelectItem>
                            {allHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={f.operator} onValueChange={(v) => updateCustomFilter(i, { operator: v })}>
                          <SelectTrigger className="h-7 text-[10px] bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="starts">Starts With</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input 
                          className="h-7 text-[10px] bg-white" 
                          placeholder="Value..." 
                          value={f.value}
                          onChange={(e) => updateCustomFilter(i, { value: e.target.value })}
                        />
                      </div>
                    ))}
                    {customFilters.length === 0 && (
                      <div className="text-center py-4 border-2 border-dashed rounded-xl border-slate-100">
                        <p className="text-[10px] text-slate-400">No active filters</p>
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  className="w-full shadow-lg shadow-primary/20" 
                  onClick={generateReport} 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Apply & Generate
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b bg-white">
            <div className="flex items-center gap-4">
              {!showFilters && (
                <Button variant="outline" size="sm" onClick={() => setShowFilters(true)}>
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              )}
              <Tabs defaultValue="visuals" className="w-auto">
                <TabsList className="bg-slate-100/50 p-1">
                  <TabsTrigger value="visuals" className="text-xs gap-2">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Visuals
                  </TabsTrigger>
                  <TabsTrigger value="pivot" className="text-xs gap-2">
                    <TableIcon className="w-3.5 h-3.5" />
                    Pivot Table
                  </TabsTrigger>
                  <TabsTrigger value="explorer" className="text-xs gap-2">
                    <Search className="w-3.5 h-3.5" />
                    Explorer
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadReport} disabled={reportData.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={downloadPDF} disabled={reportData.length === 0}>
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <Tabs defaultValue="visuals" className="h-full">
              <TabsContent value="visuals" className="m-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold text-slate-600">Distribution Analysis</CardTitle>
                        <div className="flex gap-1">
                          <Button 
                            variant={config.chartType === 'bar' ? 'secondary' : 'ghost'} 
                            size="icon" className="h-7 w-7"
                            onClick={() => setConfig({...config, chartType: 'bar'})}
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant={config.chartType === 'line' ? 'secondary' : 'ghost'} 
                            size="icon" className="h-7 w-7"
                            onClick={() => setConfig({...config, chartType: 'line'})}
                          >
                            <LineChartIcon className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant={config.chartType === 'area' ? 'secondary' : 'ghost'} 
                            size="icon" className="h-7 w-7"
                            onClick={() => setConfig({...config, chartType: 'area'})}
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="h-[300px] pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        {config.chartType === 'bar' ? (
                          <BarChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                            {config.subGroupBy === 'none' ? (
                              <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Volume" />
                            ) : (
                              subGroupKeys.map((key, index) => (
                                <Bar key={key} dataKey={key} stackId="a" fill={COLORS[index % COLORS.length]} />
                              ))
                            )}
                          </BarChart>
                        ) : config.chartType === 'line' ? (
                          <LineChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                            {config.subGroupBy === 'none' ? (
                              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                            ) : (
                              subGroupKeys.map((key, index) => (
                                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                              ))
                            )}
                          </LineChart>
                        ) : (
                          <AreaChart data={reportData}>
                            <defs>
                              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                          </AreaChart>
                        )}
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold text-slate-600">Composition Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {reportData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                          <Legend iconType="circle" layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="pivot" className="m-0">
                <Card className="border-none shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50/50">
                        <tr>
                          <th className="px-6 py-4 font-bold border-b">{config.groupBy}</th>
                          {config.subGroupBy !== 'none' ? (
                            <>
                              {subGroupKeys.map(k => (
                                <th key={k} className="px-6 py-4 font-bold text-center border-b">{k}</th>
                              ))}
                              <th className="px-6 py-4 font-bold text-center border-b bg-blue-50/50 text-blue-600">Total</th>
                            </>
                          ) : (
                            <th className="px-6 py-4 font-bold text-center border-b">Count</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 font-semibold text-slate-700">{row.name}</td>
                            {config.subGroupBy !== 'none' ? (
                              <>
                                {subGroupKeys.map(k => (
                                  <td key={k} className="px-6 py-4 text-center text-slate-500">{row[k] || 0}</td>
                                ))}
                                <td className="px-6 py-4 text-center font-black text-blue-600 bg-blue-50/30">{row.value}</td>
                              </>
                            ) : (
                              <td className="px-6 py-4 text-center text-slate-500 font-medium">{row.value}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/80 font-bold">
                        <tr>
                          <td className="px-6 py-4">Grand Total</td>
                          {config.subGroupBy !== 'none' ? (
                            <>
                              {subGroupKeys.map(k => (
                                <td key={k} className="px-6 py-4 text-center">
                                  {reportData.reduce((acc, curr) => acc + (curr[k] || 0), 0)}
                                </td>
                              ))}
                              <td className="px-6 py-4 text-center text-blue-700 bg-blue-100/50">
                                {reportData.reduce((acc, curr) => acc + curr.value, 0)}
                              </td>
                            </>
                          ) : (
                            <td className="px-6 py-4 text-center">
                              {reportData.reduce((acc, curr) => acc + curr.value, 0)}
                            </td>
                          )}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="explorer" className="m-0">
                <Card className="border-none shadow-sm overflow-hidden">
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 bg-white shadow-sm z-10">
                        <tr className="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50/50">
                          <th className="px-4 py-3 border-b">Status</th>
                          <th className="px-4 py-3 border-b">Assignee</th>
                          <th className="px-4 py-3 border-b">Sheet</th>
                          {allHeaders.map(h => (
                            <th key={h} className="px-4 py-3 border-b whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rawRecords.slice(0, 100).map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                r.status === 'in-progress' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">
                              {r.assignedUserId ? members.find(m => m.uid === r.assignedUserId)?.displayName : 'Unassigned'}
                            </td>
                            <td className="px-4 py-3 text-slate-400">{r.sheetName}</td>
                            {allHeaders.map(h => (
                              <td key={h} className="px-4 py-3 text-slate-500">{r.dataFields[h] || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rawRecords.length > 100 && (
                      <div className="p-4 text-center text-slate-400 text-[10px] uppercase tracking-widest border-t">
                        Showing first 100 records. Use filters to narrow down results.
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

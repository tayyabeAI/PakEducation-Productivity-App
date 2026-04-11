import { useState, useEffect, useRef } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, orderBy, or, and, getDocs, limit, startAfter } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { TeamDataRecord, UserProfile } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Upload, FileSpreadsheet, Search, Filter, Edit2, Save, X, Trash2, Plus, Download, Printer, ChevronDown, ChevronRight, RefreshCw, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from './ui/dialog';
import { deleteDoc, writeBatch } from 'firebase/firestore';
import AdvancedReporting from './AdvancedReporting';

interface TeamDataViewProps {
  teamId: string;
  members: UserProfile[];
}

export default function TeamDataView({ teamId, members }: TeamDataViewProps) {
  const { user } = useAuth();
  const [records, setRecords] = useState<TeamDataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [sheetFilter, setSheetFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload State
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('unassigned');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Reporting State
  const [isReportingOpen, setIsReportingOpen] = useState(false);

  // Edit State
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  // Custom Dialog States
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const [promptDialog, setPromptDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    value: string;
    onConfirm: (val: string) => void;
  }>({ open: false, title: '', description: '', value: '', onConfirm: () => {} });

  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchInitialRecords();
  }, [user?.uid, teamId, statusFilter, userFilter, sheetFilter]);

  const fetchInitialRecords = () => {
    if (!user || !teamId) return;
    setLoading(true);
    setRecords([]);
    setLastDoc(null);
    setHasMore(true);

    const q = buildQuery(null);
    
    getDocs(q).then((s) => {
      const newRecords = s.docs.map(d => ({ id: d.id, ...d.data() } as TeamDataRecord));
      setRecords(newRecords);
      setLastDoc(s.docs[s.docs.length - 1]);
      setHasMore(s.docs.length === PAGE_SIZE);
      setLoading(false);
    }).catch((error) => {
      handleFirestoreError(error, OperationType.LIST, 'team_data');
      setLoading(false);
    });
  };

  const loadMore = async () => {
    if (!user || !teamId || !lastDoc || loadingMore) return;
    setLoadingMore(true);

    try {
      const q = buildQuery(lastDoc);
      const s = await getDocs(q);
      const newRecords = s.docs.map(d => ({ id: d.id, ...d.data() } as TeamDataRecord));
      
      setRecords(prev => [...prev, ...newRecords]);
      setLastDoc(s.docs[s.docs.length - 1]);
      setHasMore(s.docs.length === PAGE_SIZE);
    } catch (error) {
      toast.error('Failed to load more records');
    } finally {
      setLoadingMore(false);
    }
  };

  const buildQuery = (afterDoc: any) => {
    let constraints: any[] = [
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    ];

    if (!isLeadOrAdmin) {
      constraints.push(or(
        where('assignedUserId', '==', user?.uid),
        where('assignedUserId', '==', null)
      ));
    }

    if (statusFilter !== 'all') {
      constraints.push(where('status', '==', statusFilter));
    }

    if (userFilter !== 'all') {
      if (userFilter === 'unassigned') {
        constraints.push(where('assignedUserId', '==', null));
      } else {
        constraints.push(where('assignedUserId', '==', userFilter));
      }
    }

    if (sheetFilter !== 'all') {
      constraints.push(where('sheetName', '==', sheetFilter));
    }

    if (afterDoc) {
      constraints.push(startAfter(afterDoc));
    }

    constraints.push(limit(PAGE_SIZE));

    return query(collection(db, 'team_data'), ...constraints);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSheetName(file.name.replace(/\.[^/.]+$/, ""));

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setParsedData(data);
      } catch (error) {
        toast.error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const processUpload = async () => {
    if (!user || parsedData.length === 0) return;
    setUploading(true);
    
    const batchId = Date.now().toString();
    const CHUNK_SIZE = 450;
    const totalChunks = Math.ceil(parsedData.length / CHUNK_SIZE);
    setUploadProgress({ current: 0, total: totalChunks });
    
    try {
      // Process chunks in parallel with a small concurrency limit to speed up
      const chunks = [];
      for (let i = 0; i < parsedData.length; i += CHUNK_SIZE) {
        chunks.push(parsedData.slice(i, i + CHUNK_SIZE));
      }

      // Process 3 chunks at a time to avoid overwhelming the client/network
      for (let i = 0; i < chunks.length; i += 3) {
        const currentBatchGroup = chunks.slice(i, i + 3);
        await Promise.all(currentBatchGroup.map(async (chunk, idx) => {
          const batch = writeBatch(db);
          chunk.forEach((row) => {
            const docRef = doc(collection(db, 'team_data'));
            const record: TeamDataRecord = {
              teamId,
              batchId,
              sheetName: sheetName || 'Untitled Sheet',
              dataFields: row,
              status: 'new',
              createdBy: user.uid,
              createdAt: serverTimestamp(),
            };
            if (selectedAssignee !== 'unassigned') record.assignedUserId = selectedAssignee;
            batch.set(docRef, record);
          });
          await batch.commit();
          setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }));
      }
      
      // Log activity
      await addDoc(collection(db, 'activity_logs'), {
        teamId,
        action: 'upload',
        details: `Uploaded sheet "${sheetName}" with ${parsedData.length} records`,
        userId: user.uid,
        timestamp: serverTimestamp()
      });

      toast.success(`Successfully uploaded ${parsedData.length} records`);
      setIsUploadDialogOpen(false);
      setParsedData([]);
      setSheetName('');
      setSelectedAssignee('unassigned');
      setUploadProgress({ current: 0, total: 0 });
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Refresh data
      fetchInitialRecords();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload records. The file might be too large or there was a connection issue.');
    } finally {
      setUploading(false);
    }
  };

  const deleteSheet = async (sheetName: string) => {
    if (!isLeadOrAdmin) return;
    
    setConfirmDialog({
      open: true,
      title: `Delete Sheet: ${sheetName}`,
      description: `Are you sure you want to delete the entire sheet "${sheetName}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const sheetRecords = records.filter(r => r.sheetName === sheetName);
          const batch = writeBatch(db);
          sheetRecords.forEach(r => {
            batch.delete(doc(db, 'team_data', r.id!));
          });
          await batch.commit();
          toast.success(`Sheet "${sheetName}" deleted`);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
          toast.error('Failed to delete sheet');
        }
      }
    });
  };

  const addRow = async () => {
    if (!isLeadOrAdmin) return;
    const currentSheet = sheetFilter === 'all' ? (records[0]?.sheetName || 'Manual Entry') : sheetFilter;
    const currentBatchId = records.find(r => r.sheetName === currentSheet)?.batchId || Date.now().toString();

    try {
      const emptyFields: Record<string, any> = {};
      allHeaders.forEach(h => emptyFields[h] = '');

      await addDoc(collection(db, 'team_data'), {
        teamId,
        batchId: currentBatchId,
        sheetName: currentSheet,
        dataFields: emptyFields,
        status: 'new',
        createdBy: user?.uid,
        createdAt: serverTimestamp()
      });
      toast.success('Row added');
    } catch (error) {
      toast.error('Failed to add row');
    }
  };

  const deleteRow = async (id: string) => {
    if (!isLeadOrAdmin) return;
    
    setConfirmDialog({
      open: true,
      title: 'Delete Row',
      description: 'Are you sure you want to delete this row?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'team_data', id));
          toast.success('Row deleted');
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
          toast.error('Failed to delete row');
        }
      }
    });
  };

  const addColumn = async () => {
    if (!isLeadOrAdmin) return;
    
    setPromptDialog({
      open: true,
      title: 'Add New Column',
      description: 'Enter the name for the new column:',
      value: '',
      onConfirm: async (columnName) => {
        if (!columnName) return;
        const currentSheet = sheetFilter === 'all' ? null : sheetFilter;
        const recordsToUpdate = currentSheet ? records.filter(r => r.sheetName === currentSheet) : records;

        try {
          const batch = writeBatch(db);
          recordsToUpdate.forEach(r => {
            batch.update(doc(db, 'team_data', r.id!), {
              [`dataFields.${columnName}`]: ''
            });
          });
          await batch.commit();
          toast.success(`Column "${columnName}" added`);
          setPromptDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
          toast.error('Failed to add column');
        }
      }
    });
  };

  const deleteColumn = async (columnName: string) => {
    if (!isLeadOrAdmin) return;
    
    setConfirmDialog({
      open: true,
      title: `Delete Column: ${columnName}`,
      description: `Are you sure you want to delete column "${columnName}" from all records in this view?`,
      onConfirm: async () => {
        const currentSheet = sheetFilter === 'all' ? null : sheetFilter;
        const recordsToUpdate = currentSheet ? records.filter(r => r.sheetName === currentSheet) : records;

        try {
          const batch = writeBatch(db);
          recordsToUpdate.forEach(r => {
            const newDataFields = { ...r.dataFields };
            delete newDataFields[columnName];
            batch.update(doc(db, 'team_data', r.id!), {
              dataFields: newDataFields
            });
          });
          await batch.commit();
          toast.success(`Column "${columnName}" deleted`);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
          toast.error('Failed to delete column');
        }
      }
    });
  };

  const truncateData = async () => {
    if (!isLeadOrAdmin) return;
    
    setConfirmDialog({
      open: true,
      title: 'Truncate All Data',
      description: 'Are you sure you want to delete ALL records for this team? This action cannot be undone.',
      onConfirm: async () => {
        setLoading(true);
        try {
          let deletedCount = 0;
          let hasMoreToDelete = true;
          
          while (hasMoreToDelete) {
            const q = query(
              collection(db, 'team_data'),
              where('teamId', '==', teamId),
              limit(500)
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
              hasMoreToDelete = false;
              break;
            }

            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            deletedCount += snapshot.size;
            
            // Safety break if it takes too long or for UI feedback
            if (snapshot.size < 500) hasMoreToDelete = false;
          }
          
          toast.success(`Successfully deleted ${deletedCount} records`);
          fetchInitialRecords();
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
          console.error('Truncate error:', error);
          toast.error('Failed to truncate data');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const exportToCSV = () => {
    const data = filteredRecords.map(r => ({
      Status: r.status,
      Assignee: r.assignedUserId ? members.find(m => m.uid === r.assignedUserId)?.displayName : 'Unassigned',
      ...r.dataFields
    }));
    const csv = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, csv, "Data");
    XLSX.writeFile(wb, `${sheetFilter === 'all' ? 'TeamData' : sheetFilter}.csv`);
  };

  const exportToExcel = () => {
    const data = filteredRecords.map(r => ({
      Status: r.status,
      Assignee: r.assignedUserId ? members.find(m => m.uid === r.assignedUserId)?.displayName : 'Unassigned',
      ...r.dataFields
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${sheetFilter === 'all' ? 'TeamData' : sheetFilter}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape') as any;
    doc.text(`Team Data Report - ${sheetFilter === 'all' ? 'All Sheets' : sheetFilter}`, 14, 15);
    
    const headers = ['Status', 'Assignee', ...allHeaders.slice(0, 8)];
    const body = filteredRecords.map(r => [
      r.status,
      r.assignedUserId ? members.find(m => m.uid === r.assignedUserId)?.displayName : 'Unassigned',
      ...allHeaders.slice(0, 8).map(h => r.dataFields[h] || '')
    ]);

    doc.autoTable({
      startY: 20,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8 }
    });
    
    doc.save(`${sheetFilter === 'all' ? 'TeamData' : sheetFilter}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEditStart = (record: TeamDataRecord) => {
    setEditingRecordId(record.id!);
    setEditFormData({ ...record.dataFields, _status: record.status });
  };

  const handleEditSave = async (recordId: string) => {
    if (!user) return;
    try {
      const { _status, ...restData } = editFormData;
      await updateDoc(doc(db, 'team_data', recordId), {
        dataFields: restData,
        status: _status || 'new',
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'activity_logs'), {
        teamId,
        action: 'update',
        details: `Updated record ${recordId}`,
        userId: user.uid,
        timestamp: serverTimestamp(),
        recordId
      });

      toast.success('Record updated');
      setEditingRecordId(null);
    } catch (error) {
      toast.error('Failed to update record');
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = JSON.stringify(r.dataFields).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Extract all unique headers from dataFields (limited to current records for performance)
  const allHeaders = Array.from(new Set(records.flatMap(r => Object.keys(r.dataFields))));
  const allSheets = Array.from(new Set(records.map(r => r.sheetName || 'Untitled Sheet')));

  const isLeadOrAdmin = user?.role === 'lead' || user?.role === 'admin' || user?.role === 'super-admin';

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Team Data Records
        </h3>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>

          <Dialog open={isReportingOpen} onOpenChange={setIsReportingOpen}>
            <DialogTrigger render={
              <Button variant="outline" size="sm" className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                BI Dashboard
              </Button>
            } />
            <DialogContent className="sm:max-w-[1200px] w-[98vw] h-[95vh] p-0 overflow-hidden flex flex-col border-none">
              <div className="flex-1 min-h-0">
                <AdvancedReporting 
                  teamId={teamId}
                  members={members}
                  allHeaders={allHeaders}
                  allSheets={allSheets}
                />
              </div>
            </DialogContent>
          </Dialog>

          <Select value={sheetFilter} onValueChange={setSheetFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Select Sheet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sheets</SelectItem>
              {allSheets.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLeadOrAdmin && (
            <div className="flex gap-2">
              {sheetFilter !== 'all' && (
                <Button variant="destructive" size="sm" onClick={() => deleteSheet(sheetFilter)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Sheet
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={truncateData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Truncate All Data
              </Button>
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger render={
                  <Button size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                } />
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Upload Data Records</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Sheet Name</Label>
                      <Input 
                        placeholder="Enter sheet name" 
                        value={sheetName}
                        onChange={(e) => setSheetName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Select File (.xlsx, .csv)</Label>
                      <Input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleFileUpload}
                        ref={fileInputRef}
                      />
                    </div>
                    
                    {parsedData.length > 0 && (
                      <>
                        <div className="p-3 bg-slate-50 rounded-lg text-sm">
                          <p className="font-medium text-slate-700">File parsed successfully</p>
                          <p className="text-slate-500">{parsedData.length} rows found</p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Assign To (Optional)</Label>
                          <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select team member" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned (Visible to all)</SelectItem>
                              {members.map(m => (
                                <SelectItem key={m.uid} value={m.uid}>{m.displayName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                  <DialogFooter>
                    {uploading && (
                      <div className="flex-1 text-xs text-slate-500 flex items-center gap-2">
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary h-full transition-all duration-300" 
                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                          />
                        </div>
                        <span className="whitespace-nowrap">{uploadProgress.current}/{uploadProgress.total}</span>
                      </div>
                    )}
                    <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)} disabled={uploading}>Cancel</Button>
                    <Button 
                      onClick={processUpload} 
                      disabled={parsedData.length === 0 || uploading}
                      className="min-w-[120px]"
                    >
                      {uploading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Uploading...</span>
                        </div>
                      ) : 'Upload Data'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>

        {isLeadOrAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addColumn}>
              <Plus className="w-4 h-4 mr-2" />
              Add Column
            </Button>
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="w-4 h-4 mr-2" />
              Add Row
            </Button>
          </div>
        )}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search records..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="w-4 h-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.uid} value={m.uid}>{m.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-slate-500 animate-pulse">Loading team records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No records found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Status</th>
                      <th className="px-4 py-3">Assignee</th>
                      {allHeaders.map(header => (
                        <th key={header} className="px-4 py-3 group relative">
                          <div className="flex items-center gap-2">
                            {header}
                            {isLeadOrAdmin && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 opacity-0 group-hover:opacity-100 text-red-500"
                                onClick={() => deleteColumn(header)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(record => {
                      const canEdit = isLeadOrAdmin || record.assignedUserId === user?.uid;
                      
                      return (
                        <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            {editingRecordId === record.id ? (
                              <Select 
                                value={editFormData._status || record.status} 
                                onValueChange={(v) => setEditFormData({...editFormData, _status: v})}
                              >
                                <SelectTrigger className="h-8 w-[110px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new">New</SelectItem>
                                  <SelectItem value="in-progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                                record.status === 'completed' ? 'bg-green-100 text-green-700' :
                                record.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {record.status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {record.assignedUserId ? members.find(m => m.uid === record.assignedUserId)?.displayName || 'Unknown' : 'Unassigned'}
                          </td>
                          
                          {allHeaders.map(header => (
                            <td key={header} className="px-4 py-3 max-w-[200px] truncate">
                              {editingRecordId === record.id ? (
                                <Input 
                                  className="h-8 text-xs"
                                  value={editFormData[header] || ''}
                                  onChange={(e) => setEditFormData({...editFormData, [header]: e.target.value})}
                                />
                              ) : (
                                record.dataFields[header]?.toString() || '-'
                              )}
                            </td>
                          ))}
                          
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {editingRecordId === record.id ? (
                                <>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleEditSave(record.id!)}>
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => setEditingRecordId(null)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {canEdit && (
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditStart(record)}>
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {isLeadOrAdmin && (
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => deleteRow(record.id!)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <Button 
                    variant="outline" 
                    onClick={loadMore} 
                    disabled={loadingMore}
                    className="min-w-[200px]"
                  >
                    {loadingMore ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span>Loading more...</span>
                      </div>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Load More Records
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDialog.onConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt Dialog */}
      <Dialog open={promptDialog.open} onOpenChange={(open) => setPromptDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{promptDialog.title}</DialogTitle>
            <DialogDescription>{promptDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={promptDialog.value} 
              onChange={(e) => setPromptDialog(prev => ({ ...prev, value: e.target.value }))}
              placeholder="Enter value..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
            <Button onClick={() => promptDialog.onConfirm(promptDialog.value)}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

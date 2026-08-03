import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { colors } from "../../constants/theme";
import { Card, Badge, Button, Input, TextArea, Select, Modal, ConfirmModal, Toast, EmailPreviewModal } from "../../components/ui";
import { Briefcase, Star, Plus, Edit, Trash2, Eye, Save, Upload, ExternalLink, X, GripVertical } from "lucide-react";

const SHOW_SYNDICATION_UI = false;

const ensureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
};

const AdminDeals = ({ t, data, setData, addLog, onViewDeal }) => {
  const [tab, setTab] = useState("fund"); // 'fund' or 'syndication'
  const [syndicationFilter, setSyndicationFilter] = useState("active"); // 'active' or 'past'
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [form, setForm] = useState({
    companyName: "",
    sector: "",
    stage: "Series A",
    coInvestors: "",
    description: "",
    valuation: "",
    checkSize: "",
    logo: "",
    isPreMoney: false,
    isPostMoney: false,
    isApproximate: false,
    yearEstablished: "",
    city: "",
    country: "",
    companyWebsite: "",
    isFund: true,
    isSyndication: false,
    syndicationStatus: "active",
    memoUrl: "",
    deckUrl: "",
    additionalMedia: [],
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingMemo, setUploadingMemo] = useState(false);
  const [uploadingDeck, setUploadingDeck] = useState(false);
  const [uploadingAdditional, setUploadingAdditional] = useState({});
  const [draggedMediaIndex, setDraggedMediaIndex] = useState(null);
  const [dragOverMediaIndex, setDragOverMediaIndex] = useState(null);
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const initialFormRef = useRef(null);

  const reset = () => {
    setForm({
      companyName: "",
      sector: "",
      stage: "Series A",
      coInvestors: "",
      description: "",
      valuation: "",
      checkSize: "",
      logo: "",
      isPreMoney: false,
      isPostMoney: false,
      isApproximate: false,
      yearEstablished: "",
      city: "",
      country: "",
      companyWebsite: "",
      isFund: tab === "fund",
      isSyndication: tab === "syndication",
      syndicationStatus: "active",
      memoUrl: "",
      deckUrl: "",
      additionalMedia: [],
    });
    setLogoFile(null);
    setLogoPreview(null);
  };

  const rememberFormSnapshot = (nextForm) => {
    initialFormRef.current = JSON.stringify(nextForm);
  };

  const isEditingDeal = showAdd || showEdit;
  const hasUnsavedChanges = isEditingDeal && (
    initialFormRef.current !== JSON.stringify(form) ||
    !!logoFile
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Helper function to parse monetary values like "$50M" to numbers
  const parseMonetary = (value) => {
    if (!value) return null;
    const cleanValue = value.replace(/[$,]/g, '').trim().toUpperCase();
    if (cleanValue.endsWith('M')) {
      return parseFloat(cleanValue.slice(0, -1)) * 1000000;
    } else if (cleanValue.endsWith('K')) {
      return parseFloat(cleanValue.slice(0, -1)) * 1000;
    } else if (cleanValue.endsWith('B')) {
      return parseFloat(cleanValue.slice(0, -1)) * 1000000000;
    }
    return parseFloat(cleanValue) || null;
  };

  // Helper to format numbers back to readable format for input fields
  const formatMonetary = (value) => {
    if (!value || value === 0) return '';
    // Handle both numeric and string values from database
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    
    if (num >= 1000000000) {
      return `$${(num / 1000000000).toFixed(1)}B`;
    } else if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(0)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toLocaleString()}`;
  };

  // Helper to handle logo file selection
  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) {
        setToast({ message: 'Please upload a valid image file (PNG, JPG, WEBP, or SVG)', type: 'error' });
        return;
      }
      
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        setToast({ message: 'Image size must be less than 2MB', type: 'error' });
        return;
      }
      
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to upload logo to Supabase Storage
  const uploadLogo = async (file, dealId) => {
    if (!file) return null;
    
    try {
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${dealId}_${timestamp}.${fileExt}`;
      const filePath = fileName;
      
      const { data, error } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      return filePath;
    } catch (err) {
      throw err;
    }
  };

  // Helper to delete old logo from storage
  const deleteOldLogo = async (logoPath) => {
    if (!logoPath) return;
    if (logoPath.length <= 4 || logoPath.startsWith('http')) return;
    
    try {
      await supabase.storage
        .from('company-logos')
        .remove([logoPath]);
    } catch (err) {
      // Silently fail - not critical if old logo deletion fails
    }
  };

  // Handle memo upload
  const handleMemoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingMemo(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `deal-memos/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('deal-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('deal-documents')
        .getPublicUrl(filePath);
      
      setForm(prev => ({
        ...prev,
        memoUrl: urlData.publicUrl
      }));
      
    } catch (err) {
      console.error('Upload error:', err);
      setToast({ message: 'Error uploading memo: ' + err.message, type: 'error' });
    }
    
    setUploadingMemo(false);
  };

  // Handle deck upload
  const handleDeckUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingDeck(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `deal-decks/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('deal-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('deal-documents')
        .getPublicUrl(filePath);
      
      setForm(prev => ({
        ...prev,
        deckUrl: urlData.publicUrl
      }));
      
    } catch (err) {
      console.error('Upload error:', err);
      setToast({ message: 'Error uploading deck: ' + err.message, type: 'error' });
    }
    
    setUploadingDeck(false);
  };

  const handleMediaDragStart = (index) => (e) => {
    setDraggedMediaIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(index)); } catch (_) {}
  };

  const handleMediaDragOver = (index) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverMediaIndex !== index) setDragOverMediaIndex(index);
  };

  const handleMediaDragLeave = (index) => () => {
    if (dragOverMediaIndex === index) setDragOverMediaIndex(null);
  };

  const handleMediaDrop = (index) => (e) => {
    e.preventDefault();
    const from = draggedMediaIndex;
    setDraggedMediaIndex(null);
    setDragOverMediaIndex(null);
    if (from === null || from === undefined || from === index) return;
    setForm((prev) => {
      const list = [...(prev.additionalMedia || [])];
      const [moved] = list.splice(from, 1);
      list.splice(index, 0, moved);
      return { ...prev, additionalMedia: list };
    });
    setUploadingAdditional((prev) => {
      const list = Object.keys(prev);
      if (list.length === 0) return prev;
      // Rebuild upload-status map against new indices.
      const oldArr = list.map((k) => prev[k]);
      const [moved] = oldArr.splice(from, 1);
      oldArr.splice(index, 0, moved);
      const next = {};
      oldArr.forEach((v, i) => { if (v !== undefined) next[i] = v; });
      return next;
    });
  };

  const handleMediaDragEnd = () => {
    setDraggedMediaIndex(null);
    setDragOverMediaIndex(null);
  };

  // Handle adding additional media item
  const handleAddAdditionalMedia = () => {
    setForm({
      ...form,
      additionalMedia: [...form.additionalMedia, { title: '', url: '' }]
    });
  };

  // Handle removing additional media item
  const handleRemoveAdditionalMedia = (index) => {
    setForm({
      ...form,
      additionalMedia: form.additionalMedia.filter((_, i) => i !== index)
    });
  };

  // Handle updating additional media title
  const handleAdditionalMediaTitleChange = (index, title) => {
    const updated = [...form.additionalMedia];
    updated[index] = { ...updated[index], title };
    setForm({ ...form, additionalMedia: updated });
  };

  // Handle additional media file upload
  const handleAdditionalMediaUpload = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingAdditional({ ...uploadingAdditional, [index]: true });
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `deal-media/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('deal-documents')
        .upload(filePath, file);
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('deal-documents')
        .getPublicUrl(filePath);
      
      const updated = [...form.additionalMedia];
      updated[index] = { ...updated[index], url: urlData.publicUrl };
      setForm({ ...form, additionalMedia: updated });
      
    } catch (err) {
      console.error('Upload error:', err);
      setToast({ message: 'Error uploading file: ' + err.message, type: 'error' });
    }
    
    setUploadingAdditional({ ...uploadingAdditional, [index]: false });
  };

  // Helper to get public URL for a logo
  const getLogoUrl = (logoPath) => {
    if (!logoPath) return null;
    if (logoPath.startsWith('http')) return logoPath;
    if (logoPath.length <= 4) return logoPath;
    
    const { data } = supabase.storage
      .from('company-logos')
      .getPublicUrl(logoPath);
    
    const url = data.publicUrl;
    if (logoPath.includes('_')) {
      return url;
    }
    return `${url}?v=${Date.now()}`;
  };

  // Get deals based on current tab
  const fundDeals = data.fundHoldings || [];
  const syndicationDeals = data.syndicationDeals || [];
  const activeSyndications = syndicationDeals.filter((d) => d.syndicationStatus !== "past");
  const pastSyndications = syndicationDeals.filter((d) => d.syndicationStatus === "past");

  // Drag and Drop handlers for reordering
  const handleDragStart = (e, deal, index) => {
    setDraggedDeal({ deal, index });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", deal.id);
    e.currentTarget.style.opacity = "0.5";
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = "1";
    setDraggedDeal(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (!draggedDeal || draggedDeal.index === targetIndex) {
      setDraggedDeal(null);
      setDragOverIndex(null);
      return;
    }

    const sourceIndex = draggedDeal.index;

    if (tab === "fund") {
      setData((p) => {
        const newDeals = [...p.fundHoldings];
        const [removed] = newDeals.splice(sourceIndex, 1);
        newDeals.splice(targetIndex, 0, removed);
        return { ...p, fundHoldings: newDeals };
      });
    } else {
      // For syndication, we need to reorder within the filtered list but update the full array
      setData((p) => {
        const currentList = syndicationFilter === "active" ? activeSyndications : pastSyndications;
        const dealToMove = currentList[sourceIndex];
        const targetDeal = currentList[targetIndex];

        // Find positions in the full syndicationDeals array
        const fullSourceIdx = p.syndicationDeals.findIndex((d) => d.id === dealToMove.id);
        const fullTargetIdx = p.syndicationDeals.findIndex((d) => d.id === targetDeal.id);

        const newDeals = [...p.syndicationDeals];
        const [removed] = newDeals.splice(fullSourceIdx, 1);
        newDeals.splice(fullTargetIdx, 0, removed);
        return { ...p, syndicationDeals: newDeals };
      });
    }

    addLog("dealReordered", `Reordered: ${draggedDeal.deal.companyName}`, `並べ替え: ${draggedDeal.deal.companyName}`);
    setToast({ message: "Deal order updated", type: "success" });
    setDraggedDeal(null);
    setDragOverIndex(null);
  };

  const handleAdd = async () => {
    if (!form.companyName || !form.sector) return;
    setUploading(true);
    try {
      // Build base deal object (without logo initially)
      const baseDeal = {
        name: form.companyName,
        name_ja: form.companyNameJa,
        sector: form.sector,
        sector_ja: form.sectorJa,
        stage: form.stage,
        description: form.description,
        description_ja: form.descriptionJa,
        valuation: parseMonetary(form.valuation),
        check_size: parseMonetary(form.checkSize),
        is_pre_money: form.isPreMoney ? true : form.isPostMoney ? false : null,
        valuation_approximate: form.isApproximate === true,
        year_established: form.yearEstablished ? parseInt(form.yearEstablished) : null,
        city: form.city || null,
        country: form.country || null,
        company_website: form.companyWebsite || null,
        logo: null, // Will update after upload
        co_investors: form.coInvestors ? form.coInvestors.split(",").map((i) => i.trim()) : [],
        dd_complete: false,
        dd_reports: [],
        sort_order: 0,
        memo_url: form.memoUrl || null,
        deck_url: form.deckUrl || null,
        additional_media: form.additionalMedia || [],
      };
      
      // Add syndication-specific fields
      const newDeal = form.isFund 
        ? baseDeal 
        : { 
            ...baseDeal, 
            syndication_status: form.syndicationStatus || "active" 
          };
      
      const table = form.isFund ? 'fund_holdings' : 'syndication_deals';
      
      // First insert the deal to get the ID
      const { data: inserted, error } = await supabase.from(table).insert(newDeal).select().single();
      if (error) throw error;
      
      // Upload logo if file selected
      let logoPath = null;
      if (logoFile) {
        logoPath = await uploadLogo(logoFile, inserted.id);
        
        // Update deal with logo path
        const { error: updateError } = await supabase
          .from(table)
          .update({ logo: logoPath })
          .eq('id', inserted.id);
        
        if (updateError) throw updateError;
      }
      
      const mapped = {
        id: inserted.id,
        name: inserted.name,
        companyName: inserted.name,
        name_ja: inserted.name_ja,
        companyNameJa: inserted.name_ja,
        sector: inserted.sector,
        sector_ja: inserted.sector_ja,
        sectorJa: inserted.sector_ja,
        stage: inserted.stage,
        description: inserted.description,
        description_ja: inserted.description_ja,
        descriptionJa: inserted.description_ja,
        valuation: inserted.valuation,
        check_size: inserted.check_size,
        checkSize: inserted.check_size,
        is_pre_money: inserted.is_pre_money,
        isPreMoney: inserted.is_pre_money,
        isPostMoney: inserted.is_pre_money === false,
        valuation_approximate: inserted.valuation_approximate === true,
        isApproximate: inserted.valuation_approximate === true,
        year_established: inserted.year_established,
        yearEstablished: inserted.year_established,
        city: inserted.city,
        country: inserted.country,
        companyWebsite: inserted.company_website,
        company_website: inserted.company_website,
        logo: logoPath || inserted.logo,
        co_investors: inserted.co_investors,
        coInvestors: inserted.co_investors,
        dd_complete: inserted.dd_complete,
        ddComplete: inserted.dd_complete,
        dd_reports: inserted.dd_reports,
        ddReports: inserted.dd_reports,
        sort_order: inserted.sort_order,
        sortOrder: inserted.sort_order,
        created_at: inserted.created_at,
        memoUrl: inserted.memo_url,
        memo_url: inserted.memo_url,
        deckUrl: inserted.deck_url,
        deck_url: inserted.deck_url,
        additionalMedia: inserted.additional_media,
        additional_media: inserted.additional_media,
        ...(inserted.syndication_status !== undefined && { 
          syndication_status: inserted.syndication_status,
          syndicationStatus: inserted.syndication_status 
        }),
      };
      
      if (form.isFund) {
        setData((p) => ({ ...p, fundHoldings: [...p.fundHoldings, mapped] }));
      } else {
        setData((p) => ({ ...p, syndicationDeals: [...p.syndicationDeals, mapped] }));
      }
      
      addLog("dealAdded", `Added deal: ${form.companyName}`);
      setPendingEmail({
        type: "deal",
        title: form.companyName,
        summary: [form.sector, form.stage, form.description].filter(Boolean).join("\n"),
        actionUrl: window.location.origin,
      });
      initialFormRef.current = null;
      setShowAdd(false);
      reset();
      setToast({ message: "Deal added", type: "success" });
    } catch (err) {
      setToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async () => {
    if (!form.companyName || !form.sector) return;
    setUploading(true);
    try {
      let logoPath = form.logo;
      
      if (logoFile) {
        if (sel.logo && sel.logo.length > 4 && !sel.logo.startsWith('http')) {
          await deleteOldLogo(sel.logo);
        }
        logoPath = await uploadLogo(logoFile, sel.id);
      }
      
      const baseUpdates = {
        name: form.companyName,
        name_ja: form.companyNameJa,
        sector: form.sector,
        sector_ja: form.sectorJa,
        stage: form.stage,
        description: form.description,
        description_ja: form.descriptionJa,
        valuation: parseMonetary(form.valuation),
        check_size: parseMonetary(form.checkSize),
        is_pre_money: form.isPreMoney ? true : form.isPostMoney ? false : null,
        valuation_approximate: form.isApproximate === true,
        year_established: form.yearEstablished ? parseInt(form.yearEstablished) : null,
        city: form.city || null,
        country: form.country || null,
        company_website: form.companyWebsite || null,
        logo: logoPath,
        co_investors: form.coInvestors ? form.coInvestors.split(",").map((i) => i.trim()) : [],
        memo_url: form.memoUrl || null,
        deck_url: form.deckUrl || null,
        additional_media: form.additionalMedia || [],
      };
      
      const updates = tab === 'fund'
        ? baseUpdates 
        : { 
            ...baseUpdates, 
            syndication_status: form.syndicationStatus 
          };
      
      const table = tab === 'fund' ? 'fund_holdings' : 'syndication_deals';
      const { error } = await supabase.from(table).update(updates).eq('id', sel.id);
      if (error) throw error;
      
      const updatedDeal = {
        id: sel.id,
        name: updates.name,
        companyName: updates.name,
        name_ja: updates.name_ja,
        companyNameJa: updates.name_ja,
        sector: updates.sector,
        sector_ja: updates.sector_ja,
        sectorJa: updates.sector_ja,
        stage: updates.stage,
        description: updates.description,
        description_ja: updates.description_ja,
        descriptionJa: updates.description_ja,
        valuation: updates.valuation,
        check_size: updates.check_size,
        checkSize: updates.check_size,
        is_pre_money: updates.is_pre_money,
        isPreMoney: updates.is_pre_money,
        isPostMoney: updates.is_pre_money === false,
        valuation_approximate: updates.valuation_approximate === true,
        isApproximate: updates.valuation_approximate === true,
        year_established: updates.year_established,
        yearEstablished: updates.year_established,
        city: updates.city,
        country: updates.country,
        companyWebsite: updates.company_website,
        company_website: updates.company_website,
        logo: logoPath,
        co_investors: updates.co_investors,
        coInvestors: updates.co_investors,
        memoUrl: updates.memo_url,
        memo_url: updates.memo_url,
        deckUrl: updates.deck_url,
        deck_url: updates.deck_url,
        additionalMedia: updates.additional_media,
        additional_media: updates.additional_media,
        ...(updates.syndication_status !== undefined && { 
          syndication_status: updates.syndication_status,
          syndicationStatus: updates.syndication_status 
        }),
      };
      
      if (tab === 'fund') {
        setData((p) => ({ 
          ...p, 
          fundHoldings: p.fundHoldings.map((d) => 
            d.id === sel.id ? { ...d, ...updatedDeal } : d
          ) 
        }));
      } else {
        setData((p) => ({ 
          ...p, 
          syndicationDeals: p.syndicationDeals.map((d) => 
            d.id === sel.id ? { ...d, ...updatedDeal } : d
          ) 
        }));
      }
      
      addLog("dealEdited", `Edited deal: ${form.companyName}`);
      initialFormRef.current = null;
      setShowEdit(false);
      setSel(null);
      reset();
      setToast({ message: "Deal updated successfully", type: "success" });
    } catch (err) {
      setToast({ message: `Error: ${err.message}`, type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleDel = async () => {
    try {
      const table = tab === 'fund' ? 'fund_holdings' : 'syndication_deals';
      const { error } = await supabase.from(table).delete().eq('id', sel.id);
      if (error) throw error;
      
      if (tab === 'fund') {
        setData((p) => ({ ...p, fundHoldings: p.fundHoldings.filter((d) => d.id !== sel.id) }));
      } else {
        setData((p) => ({ ...p, syndicationDeals: p.syndicationDeals.filter((d) => d.id !== sel.id) }));
      }
      
      addLog("dealDeleted", `Deleted deal: ${sel.companyName}`);
      setShowDel(false);
      setSel(null);
      setToast({ message: "Deal deleted", type: "success" });
    } catch (err) {
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const toggleSyndicationStatus = async (deal) => {
    try {
      const newStatus = deal.syndicationStatus === "past" ? "active" : "past";
      
      const { error } = await supabase
        .from('syndication_deals')
        .update({ syndication_status: newStatus })
        .eq('id', deal.id);
      
      if (error) throw error;
      
      setData((p) => ({
        ...p,
        syndicationDeals: p.syndicationDeals.map((d) => (d.id === deal.id ? { ...d, syndicationStatus: newStatus } : d)),
      }));
      addLog("dealEdited", `${deal.companyName} marked as ${newStatus}`, `${deal.companyName}: ${newStatus}`);
      setToast({ message: `Marked as ${newStatus}`, type: "success" });
    } catch (err) {
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const openEdit = (d) => {
    setSel(d);
    const nextForm = {
      companyName: d.companyName || "",
      sector: d.sector || "",
      stage: d.stage || "Series A",
      coInvestors: d.coInvestors?.join(", ") || "",
      description: d.description || "",
      valuation: formatMonetary(d.valuation),
      checkSize: formatMonetary(d.checkSize),
      logo: d.logo || "",
      isPreMoney: d.isPreMoney === true,
      isPostMoney: d.isPreMoney === false,
      isApproximate: d.isApproximate === true || d.valuation_approximate === true,
      yearEstablished: d.yearEstablished || "",
      city: d.city || "",
      country: d.country || "",
      companyWebsite: d.companyWebsite || d.company_website || "",
      isFund: tab === "fund",
      isSyndication: tab === "syndication",
      syndicationStatus: d.syndicationStatus || "active",
      memoUrl: d.memoUrl || d.memo_url || "",
      deckUrl: d.deckUrl || d.deck_url || "",
      additionalMedia: d.additionalMedia || d.additional_media || [],
    };
    setForm(nextForm);
    rememberFormSnapshot(nextForm);
    
    // Set logo preview to show existing logo
    if (d.logo) {
      setLogoPreview(getLogoUrl(d.logo));
    } else {
      setLogoPreview(null);
    }
    // Clear any new file selection
    setLogoFile(null);
    
    setShowEdit(true);
  };

  const currentDeals = !SHOW_SYNDICATION_UI || tab === "fund"
    ? fundDeals
    : syndicationFilter === "active"
      ? activeSyndications
      : pastSyndications;

  return (
    <div className="space-y-6">
      {/* Tab Selection */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        <button
          onClick={() => setTab("fund")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            tab === "fund" ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          style={tab === "fund" ? { backgroundColor: colors.primary } : {}}
        >
          <Briefcase size={16} /> Fund Holdings{" "}
          <span className="px-1.5 py-0.5 rounded text-xs bg-white/20">{fundDeals.length}</span>
        </button>
        {SHOW_SYNDICATION_UI && (
          <button
            onClick={() => setTab("syndication")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              tab === "syndication" ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={tab === "syndication" ? { backgroundColor: colors.accent } : {}}
          >
            <Star size={16} /> Syndications{" "}
            <span className="px-1.5 py-0.5 rounded text-xs bg-white/20">{syndicationDeals.length}</span>
          </button>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{tab === "fund" || !SHOW_SYNDICATION_UI ? "Fund Holdings" : "Syndication Deals"}</h2>
          <p className="text-sm text-gray-500">
            {tab === "fund" || !SHOW_SYNDICATION_UI ? "Kizuna Fund 1 portfolio companies" : "Investment opportunities for members"} • Drag to reorder
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => { reset(); rememberFormSnapshot({
          companyName: "",
          sector: "",
          stage: "Series A",
          coInvestors: "",
          description: "",
          valuation: "",
          checkSize: "",
          logo: "",
          isPreMoney: false,
          isPostMoney: false,
          isApproximate: false,
          yearEstablished: "",
          city: "",
          country: "",
          companyWebsite: "",
          isFund: tab === "fund",
          isSyndication: tab === "syndication",
          syndicationStatus: "active",
          memoUrl: "",
          deckUrl: "",
          additionalMedia: [],
        }); setShowAdd(true); }}>
          Add Deal
        </Button>
      </div>

      {/* Syndication Filter */}
      {SHOW_SYNDICATION_UI && tab === "syndication" && (
        <div className="flex gap-2">
          <button
            onClick={() => setSyndicationFilter("active")}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              syndicationFilter === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            Active ({activeSyndications.length})
          </button>
          <button
            onClick={() => setSyndicationFilter("past")}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              syndicationFilter === "past" ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            Past ({pastSyndications.length})
          </button>
        </div>
      )}

      {/* Deals Grid with Drag & Drop */}
      {currentDeals.length === 0 ? (
        <Card>
          <p className="text-center text-gray-500 py-8">No deals yet</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentDeals.map((d, index) => (
            <Card
              key={d.id}
              className={`cursor-grab active:cursor-grabbing transition-all ${
                dragOverIndex === index ? "ring-2 ring-blue-400 bg-blue-50" : ""
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, d, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  {/* Logo - only show if uploaded image */}
                  {(() => {
                    const logoUrl = getLogoUrl(d.logo);
                    const isImageUrl = logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'));
                    
                    if (isImageUrl) {
                      return (
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                          <img 
                            src={logoUrl} 
                            alt={d.companyName} 
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      );
                    }
                    // Don't show emoji logos - only uploaded images
                    return null;
                  })()}
                  
                  {/* Company info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{d.companyName}</h3>
                    <p className="text-sm text-gray-500">{d.sector}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge variant={tab === "fund" ? "primary" : "accent"}>{d.stage}</Badge>
                  {tab === "syndication" && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        d.syndicationStatus === "past" ? "bg-gray-100 text-gray-500" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {d.syndicationStatus === "past" ? "Past" : "Active"}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                Valuation: {formatMonetary(d.valuation) || 'N/A'}
                {d.valuation && d.isPreMoney === true && <span className="text-xs text-gray-500"> (pre-money)</span>}
                {d.valuation && d.isPreMoney === false && <span className="text-xs text-gray-500"> (post-money)</span>}
              </p>
              {d.isApproximate && d.valuation && (
                <p className="text-[11px] text-gray-500 italic mb-1">To be finalized, discussions around {formatMonetary(d.valuation)} value</p>
              )}
              <p className="text-sm text-gray-600 mb-3 truncate">
                Co-Investors: {d.coInvestors && d.coInvestors.length > 0 ? d.coInvestors.join(', ') : 'N/A'}
              </p>
              {d.companyWebsite && (
                <a
                  href={ensureUrl(d.companyWebsite)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mb-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={14} />
                  Website
                </a>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" icon={Eye} onClick={() => onViewDeal(d)}>View</Button>
                <Button variant="outline" size="sm" icon={Edit} onClick={() => openEdit(d)}>Edit</Button>
                {tab === "syndication" && (
                  <Button variant="outline" size="sm" onClick={() => toggleSyndicationStatus(d)}>
                    {d.syndicationStatus === "past" ? "→ Active" : "→ Past"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  className="text-red-500"
                  onClick={() => { setSel(d); setShowDel(true); }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAdd} onClose={() => { setShowAdd(false); reset(); }} title="Add Deal" size="lg" closeOnBackdrop={false}>
        <div className="space-y-4">
          <Input label="Company Name" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} required placeholder="Company Inc." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Sector" value={form.sector} onChange={(v) => setForm({ ...form, sector: v })} required placeholder="Enterprise SaaS" />
            <Select
              label="Stage"
              value={form.stage}
              onChange={(v) => setForm({ ...form, stage: v })}
              options={[
                { value: "Pre-Seed", label: "Pre-Seed" },
                { value: "Seed", label: "Seed" },
                { value: "Seed extension round", label: "Seed extension round" },
                { value: "Series A", label: "Series A" },
                { value: "Series A+", label: "Series A+" },
                { value: "Series B", label: "Series B" },
                { value: "Series C", label: "Series C" },
                { value: "Series D", label: "Series D" },
                { value: "Series D-1", label: "Series D-1" },
                { value: "Series D+", label: "Series D+" },
                { value: "Pre Series E SAFE", label: "Pre Series E SAFE" },
              ]}
            />
          </div>
          <Input label="Valuation" value={form.valuation} onChange={(v) => setForm({ ...form, valuation: v })} placeholder="$50M" />
          
          {/* Valuation Type Checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPreMoney"
                checked={form.isPreMoney}
                onChange={(e) => setForm({ ...form, isPreMoney: e.target.checked, isPostMoney: e.target.checked ? false : form.isPostMoney })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isPreMoney" className="text-sm text-gray-700">
                This is a <strong>pre-money</strong> valuation
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPostMoney"
                checked={form.isPostMoney}
                onChange={(e) => setForm({ ...form, isPostMoney: e.target.checked, isPreMoney: e.target.checked ? false : form.isPreMoney })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isPostMoney" className="text-sm text-gray-700">
                This is a <strong>post-money</strong> valuation
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isApproximate"
                checked={form.isApproximate}
                onChange={(e) => setForm({ ...form, isApproximate: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isApproximate" className="text-sm text-gray-700">
                This is an <strong>approximation</strong>
              </label>
            </div>
            {form.isApproximate && form.valuation && (
              <p className="text-xs text-gray-500 italic pl-6">
                Will display: "To be finalized, discussions around {form.valuation} value"
              </p>
            )}
          </div>

          <Input
            label="Co-Investors (comma separated)"
            value={form.coInvestors}
            onChange={(v) => setForm({ ...form, coInvestors: v })}
            placeholder="Sequoia, a16z"
          />
          <TextArea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          
          {/* Additional Company Details */}
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Year Established"
              value={form.yearEstablished}
              onChange={(v) => setForm({ ...form, yearEstablished: v })}
              placeholder="2020"
              type="number"
            />
            <Input
              label="City"
              value={form.city}
              onChange={(v) => setForm({ ...form, city: v })}
              placeholder="San Francisco"
            />
            <Input
              label="Country"
              value={form.country}
              onChange={(v) => setForm({ ...form, country: v })}
              placeholder="USA"
            />
          </div>
          <Input
            label="Company Website"
            value={form.companyWebsite}
            onChange={(v) => setForm({ ...form, companyWebsite: v })}
            placeholder="https://company.com"
            type="url"
          />
          
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo (optional)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={handleLogoFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP, or SVG (max 2MB)</p>
            {logoPreview && (
              <div className="mt-3 flex items-center gap-3">
                <img src={logoPreview} alt="Logo preview" className="w-16 h-16 object-contain border border-gray-200 rounded-lg p-2" />
                <button
                  type="button"
                  onClick={() => {
                    setLogoFile(null);
                    setLogoPreview(null);
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Deal Type Checkboxes */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <p className="text-sm font-medium text-gray-700">Add to:</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isFund} onChange={(e) => setForm({ ...form, isFund: e.target.checked })} className="rounded" />
              <span className="text-sm">Fund Holdings (portfolio company)</span>
            </label>
            {SHOW_SYNDICATION_UI && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isSyndication} onChange={(e) => setForm({ ...form, isSyndication: e.target.checked })} className="rounded" />
                <span className="text-sm">Syndication Deals (member investment opportunity)</span>
              </label>
            )}
            {SHOW_SYNDICATION_UI && form.isSyndication && (
              <div className="ml-6 mt-2">
                <Select
                  label="Status"
                  value={form.syndicationStatus}
                  onChange={(v) => setForm({ ...form, syndicationStatus: v })}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "past", label: "Past" },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowAdd(false); reset(); }} disabled={uploading}>{t.cancel}</Button>
            <Button
              variant="primary"
              icon={Save}
              onClick={handleAdd}
              disabled={
                !form.companyName ||
                !form.sector ||
                (!form.isFund && (SHOW_SYNDICATION_UI ? !form.isSyndication : true)) ||
                uploading
              }
            >
              {uploading ? 'Uploading...' : t.save}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => { setShowEdit(false); setSel(null); reset(); }} title="Edit Deal" size="lg" closeOnBackdrop={false}>
        <div className="space-y-4">
          <Input label="Company Name" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Sector" value={form.sector} onChange={(v) => setForm({ ...form, sector: v })} required />
            <Select
              label="Stage"
              value={form.stage}
              onChange={(v) => setForm({ ...form, stage: v })}
              options={[
                { value: "Pre-Seed", label: "Pre-Seed" },
                { value: "Seed", label: "Seed" },
                { value: "Seed extension round", label: "Seed extension round" },
                { value: "Series A", label: "Series A" },
                { value: "Series A+", label: "Series A+" },
                { value: "Series B", label: "Series B" },
                { value: "Series C", label: "Series C" },
                { value: "Series D", label: "Series D" },
                { value: "Series D-1", label: "Series D-1" },
                { value: "Series D+", label: "Series D+" },
                { value: "Pre Series E SAFE", label: "Pre Series E SAFE" },
              ]}
            />
          </div>
          <Input label="Valuation" value={form.valuation} onChange={(v) => setForm({ ...form, valuation: v })} />
          
          {/* Valuation Type Checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPreMoneyEdit"
                checked={form.isPreMoney}
                onChange={(e) => setForm({ ...form, isPreMoney: e.target.checked, isPostMoney: e.target.checked ? false : form.isPostMoney })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isPreMoneyEdit" className="text-sm text-gray-700">
                This is a <strong>pre-money</strong> valuation
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPostMoneyEdit"
                checked={form.isPostMoney}
                onChange={(e) => setForm({ ...form, isPostMoney: e.target.checked, isPreMoney: e.target.checked ? false : form.isPreMoney })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isPostMoneyEdit" className="text-sm text-gray-700">
                This is a <strong>post-money</strong> valuation
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isApproximateEdit"
                checked={form.isApproximate}
                onChange={(e) => setForm({ ...form, isApproximate: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isApproximateEdit" className="text-sm text-gray-700">
                This is an <strong>approximation</strong>
              </label>
            </div>
            {form.isApproximate && form.valuation && (
              <p className="text-xs text-gray-500 italic pl-6">
                Will display: "To be finalized, discussions around {form.valuation} value"
              </p>
            )}
          </div>

          <Input label="Co-Investors (comma separated)" value={form.coInvestors} onChange={(v) => setForm({ ...form, coInvestors: v })} />
          <TextArea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          
          {/* Additional Company Details */}
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Year Established"
              value={form.yearEstablished}
              onChange={(v) => setForm({ ...form, yearEstablished: v })}
              placeholder="2020"
              type="number"
            />
            <Input
              label="City"
              value={form.city}
              onChange={(v) => setForm({ ...form, city: v })}
              placeholder="San Francisco"
            />
            <Input
              label="Country"
              value={form.country}
              onChange={(v) => setForm({ ...form, country: v })}
              placeholder="USA"
            />
          </div>
          <Input
            label="Company Website"
            value={form.companyWebsite}
            onChange={(v) => setForm({ ...form, companyWebsite: v })}
            placeholder="https://company.com"
            type="url"
          />
          
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo (optional)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={handleLogoFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP, or SVG (max 2MB) - Leave empty to keep current logo</p>
            {logoPreview && (
              <div className="mt-3 flex items-center gap-3">
                <img src={logoPreview} alt="Logo preview" className="w-16 h-16 object-contain border border-gray-200 rounded-lg p-2" />
                {logoFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      // Restore original logo preview if editing
                      if (sel?.logo) {
                        setLogoPreview(getLogoUrl(sel.logo));
                      } else {
                        setLogoPreview(null);
                      }
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove New Logo
                  </button>
                )}
              </div>
            )}
          </div>
          
          {tab === "syndication" && (
            <Select
              label="Syndication Status"
              value={form.syndicationStatus}
              onChange={(v) => setForm({ ...form, syndicationStatus: v })}
              options={[
                { value: "active", label: "Active" },
                { value: "past", label: "Past" },
              ]}
            />
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowEdit(false); setSel(null); reset(); }} disabled={uploading}>{t.cancel}</Button>
            <Button variant="primary" icon={Save} onClick={handleEdit} disabled={uploading}>
              {uploading ? 'Uploading...' : t.save}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showDel}
        onClose={() => { setShowDel(false); setSel(null); }}
        onConfirm={handleDel}
        title="Delete Deal"
        message={`Are you sure you want to delete ${sel?.companyName}?`}
        confirmText={t.delete}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <EmailPreviewModal
        notification={pendingEmail}
        onClose={() => setPendingEmail(null)}
        onSent={() => setToast({ message: "Email notification sent", type: "success" })}
        onError={(error) => setToast({ message: `Email error: ${error.message}`, type: "error" })}
      />
    </div>
  );
};

export default AdminDeals;

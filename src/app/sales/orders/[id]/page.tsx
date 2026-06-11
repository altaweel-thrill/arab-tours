"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { format } from "date-fns";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { LoadingProgress } from "@/components/loading-progrss";
import {
  ArrowLeft,
  CheckCircle,
  CircleDollarSign,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  FileWarning,
  LockKeyhole,
  Pencil,
  PlaneTakeoff,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePrivilege } from "@/hooks/usePrivilege";

/* ---------------- Types ---------------- */

type Order = {
  orderNumber?: string;
  customerId: string;
  status: string;
  totalCost: number;
  totalPrice: number;
  totalProfit: number;
  fullAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  createdAt?: any;
};

type Service = {
  id: string;
  type: string;
  description: string;
  qty?: number;
  unitCost?: number;
  cost: number;
  price?: number;
  profit?: number;
  invoiceFile?: UploadedFile;
};

type ServiceAccountingState = {
  entryIds: string[];
  status: "pending" | "confirmed";
};

type ServiceDraft = {
  type: string;
  description: string;
  qty: number;
  unitCost: number;
  invoiceFile: File | null;
};

type UploadedFile = {
  name?: string;
  url?: string;
  path?: string;
} | null;

type Payment = {
  id: string;
  amount?: number;
  paymentMethodName?: string;
  paymentMethodFeeAmount?: number;
  receiptFile?: UploadedFile;
  note?: string;
  createdAt?: any;
};

type PaymentMethod = {
  id: string;
  name: string;
  percentageRate?: number;
  fixedFee?: number;
  currency?: "SAR";
  isActive?: boolean;
};

const SERVICE_TYPES = ["Flight", "Hotel", "Visa", "Car", "Other"] as const;

/* ---------------- Page ---------------- */

export default function SalesOrderDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canUpdateSales = usePrivilege("sales.update");
  const canAddSales = usePrivilege("sales.add");
  const canManageServices = canUpdateSales || canAddSales;

  const [order, setOrder] = useState<Order | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceAccounting, setServiceAccounting] = useState<
    Record<string, ServiceAccountingState>
  >({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentMethodName, setPaymentMethodName] = useState("");
  const [paymentMethodPercentageRate, setPaymentMethodPercentageRate] = useState(0);
  const [paymentMethodFixedFee, setPaymentMethodFixedFee] = useState(0);
  const [paymentNote, setPaymentNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>({
    type: "Flight",
    description: "",
    qty: 1,
    unitCost: 0,
    invoiceFile: null,
  });

  useEffect(() => {
    if (authLoading || !user || !id) return;

    (async () => {
      try {
        // Order
        const orderRef = doc(db, "salesOrders", id as string);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          toast.error("Order not found");
          router.push("/sales");
          return;
        }

        const orderData = orderSnap.data() as Order;
        setOrder(orderData);

        // Customer
        const custSnap = await getDoc(
          doc(db, "customers", orderData.customerId)
        );
        if (custSnap.exists()) setCustomer(custSnap.data());

        // Services
        const servicesSnap = await getDocs(
          collection(db, "salesOrders", id as string, "services")
        );
        setServices(
          servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Service[]
        );

        const paymentsSnap = await getDocs(
          collection(db, "salesOrders", id as string, "payments")
        );
        setPayments(
          paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Payment[]
        );

        const paymentMethodsSnap = await getDocs(collection(db, "paymentMethods"));
        const methods = paymentMethodsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) })) as PaymentMethod[];
        setPaymentMethods(
          methods
            .filter((method) => method.isActive !== false)
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
      } catch (e) {
        console.error(e);
        toast.error("Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, id, router, user]);

  useEffect(() => {
    if (authLoading || !user || !id) return;

    const accountingQuery = query(
      collection(db, "accountingEntries"),
      where("orderId", "==", id as string)
    );

    return onSnapshot(
      accountingQuery,
      (snapshot) => {
        const nextServiceAccounting: Record<string, ServiceAccountingState> = {};
        snapshot.docs.forEach((entryDoc) => {
          const data = entryDoc.data() as any;
          if (data.sourceType !== "service_cost" || !data.serviceId) return;

          const current = nextServiceAccounting[data.serviceId] || {
            entryIds: [],
            status: "pending" as const,
          };
          nextServiceAccounting[data.serviceId] = {
            entryIds: [...current.entryIds, entryDoc.id],
            status:
              current.status === "confirmed" || data.status === "confirmed"
                ? "confirmed"
                : "pending",
          };
        });
        setServiceAccounting(nextServiceAccounting);
      },
      (error) => {
        console.error(error);
        toast.error("Failed to load service accounting status");
      }
    );
  }, [authLoading, id, user]);

  const updateStatus = async (status: string) => {
    try {
      await updateDoc(doc(db, "salesOrders", id as string), { status });
      setOrder((prev) => (prev ? { ...prev, status } : prev));
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const safeNum = (value: any) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const isServiceConfirmed = (serviceId: string) =>
    serviceAccounting[serviceId]?.status === "confirmed";

  const getFreshServiceAccounting = async (serviceId: string) => {
    const entriesSnap = await getDocs(
      query(
        collection(db, "accountingEntries"),
        where("orderId", "==", id as string)
      )
    );
    const matchingEntries = entriesSnap.docs.filter((entryDoc) => {
      const data = entryDoc.data();
      return data.sourceType === "service_cost" && data.serviceId === serviceId;
    });
    const accountingState: ServiceAccountingState = {
      entryIds: matchingEntries.map((entryDoc) => entryDoc.id),
      status: matchingEntries.some(
        (entryDoc) => entryDoc.data().status === "confirmed"
      )
        ? "confirmed"
        : "pending",
    };

    setServiceAccounting((prev) => ({
      ...prev,
      [serviceId]: accountingState,
    }));
    return accountingState;
  };

  const recalculateOrderTotals = async (nextServices: Service[]) => {
    if (!order) return;

    const totalCost = nextServices.reduce(
      (sum, service) => sum + safeNum(service.cost),
      0
    );
    const fullAmount = safeNum(order.fullAmount ?? order.totalPrice);
    const totalProfit = fullAmount - totalCost;

    await updateDoc(doc(db, "salesOrders", id as string), {
      totalCost,
      totalProfit,
      updatedAt: serverTimestamp(),
    });
    setOrder((prev) =>
      prev
        ? {
            ...prev,
            totalCost,
            totalProfit,
          }
        : prev
    );
  };

  const uploadServiceInvoice = async (serviceId: string, file: File) => {
    const filePath = `salesOrders/${id}/services/${serviceId}/invoice/${Date.now()}-${file.name}`;
    const fileRef = ref(storage, filePath);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    return {
      name: file.name,
      url,
      path: filePath,
    };
  };

  const openAddService = () => {
    setEditingServiceId(null);
    setServiceDraft({
      type: "Flight",
      description: "",
      qty: 1,
      unitCost: 0,
      invoiceFile: null,
    });
    setServiceDialogOpen(true);
  };

  const openEditService = (service: Service) => {
    if (isServiceConfirmed(service.id)) {
      toast.error("Confirmed services cannot be edited.");
      return;
    }

    const qty = Math.max(1, safeNum(service.qty) || 1);
    setEditingServiceId(service.id);
    setServiceDraft({
      type: service.type || "Other",
      description: service.description || "",
      qty,
      unitCost:
        service.unitCost !== undefined
          ? safeNum(service.unitCost)
          : safeNum(service.cost) / qty,
      invoiceFile: null,
    });
    setServiceDialogOpen(true);
  };

  const saveService = async () => {
    if (!order || !canManageServices) {
      toast.error("You do not have permission to update services.");
      return;
    }

    const qty = Math.max(1, Math.floor(safeNum(serviceDraft.qty) || 1));
    const unitCost = safeNum(serviceDraft.unitCost);
    const cost = qty * unitCost;
    const description = serviceDraft.description.trim();

    if (!serviceDraft.type.trim()) {
      toast.error("Service type is required.");
      return;
    }
    if (unitCost < 0) {
      toast.error("Unit cost cannot be negative.");
      return;
    }

    try {
      setSavingService(true);

      if (editingServiceId) {
        const accounting = await getFreshServiceAccounting(editingServiceId);
        if (accounting.status === "confirmed") {
          toast.error("Confirmed services cannot be edited.");
          setServiceDialogOpen(false);
          return;
        }

        const currentService = services.find(
          (service) => service.id === editingServiceId
        );
        if (!currentService) return;

        let invoiceFile = currentService.invoiceFile || null;
        if (serviceDraft.invoiceFile) {
          invoiceFile = await uploadServiceInvoice(
            editingServiceId,
            serviceDraft.invoiceFile
          );
        }

        await updateDoc(
          doc(db, "salesOrders", id as string, "services", editingServiceId),
          {
            type: serviceDraft.type.trim(),
            description,
            qty,
            unitCost,
            cost,
            ...(serviceDraft.invoiceFile ? { invoiceFile } : {}),
            updatedAt: serverTimestamp(),
          }
        );

        if (accounting?.entryIds.length) {
          await Promise.all(
            accounting.entryIds.map((entryId) =>
              updateDoc(doc(db, "accountingEntries", entryId), {
                amount: cost,
                description:
                  description || `${serviceDraft.type.trim()} service cost`,
                ...(serviceDraft.invoiceFile ? { file: invoiceFile } : {}),
                updatedAt: serverTimestamp(),
              })
            )
          );
        } else {
          const entryRef = await addDoc(collection(db, "accountingEntries"), {
            orderId: id as string,
            customerId: order.customerId,
            direction: "out",
            sourceType: "service_cost",
            amount: cost,
            currency: "SAR",
            description:
              description || `${serviceDraft.type.trim()} service cost`,
            orderNumber: order.orderNumber || null,
            file: invoiceFile,
            status: "pending",
            createdBy: user?.uid || null,
            createdAt: serverTimestamp(),
            confirmedBy: null,
            confirmedAt: null,
            serviceId: editingServiceId,
          });
          setServiceAccounting((prev) => ({
            ...prev,
            [editingServiceId]: {
              entryIds: [entryRef.id],
              status: "pending",
            },
          }));
        }

        const nextServices = services.map((service) =>
          service.id === editingServiceId
            ? {
                ...service,
                type: serviceDraft.type.trim(),
                description,
                qty,
                unitCost,
                cost,
                invoiceFile,
              }
            : service
        );
        await recalculateOrderTotals(nextServices);
        setServices(nextServices);
        toast.success("Service updated");
      } else {
        const serviceRef = await addDoc(
          collection(db, "salesOrders", id as string, "services"),
          {
            type: serviceDraft.type.trim(),
            description,
            qty,
            unitCost,
            cost,
            invoiceFile: null,
            createdAt: serverTimestamp(),
          }
        );

        let invoiceFile: UploadedFile = null;
        if (serviceDraft.invoiceFile) {
          invoiceFile = await uploadServiceInvoice(
            serviceRef.id,
            serviceDraft.invoiceFile
          );
          await updateDoc(serviceRef, {
            invoiceFile,
            updatedAt: serverTimestamp(),
          });
        }

        const entryRef = await addDoc(collection(db, "accountingEntries"), {
          orderId: id as string,
          customerId: order.customerId,
          direction: "out",
          sourceType: "service_cost",
          amount: cost,
          currency: "SAR",
          description:
            description || `${serviceDraft.type.trim()} service cost`,
          orderNumber: order.orderNumber || null,
          file: invoiceFile,
          status: "pending",
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
          confirmedBy: null,
          confirmedAt: null,
          serviceId: serviceRef.id,
        });

        const nextServices = [
          ...services,
          {
            id: serviceRef.id,
            type: serviceDraft.type.trim(),
            description,
            qty,
            unitCost,
            cost,
            invoiceFile,
          },
        ];
        await recalculateOrderTotals(nextServices);
        setServices(nextServices);
        setServiceAccounting((prev) => ({
          ...prev,
          [serviceRef.id]: {
            entryIds: [entryRef.id],
            status: "pending",
          },
        }));
        toast.success("Service added");
      }

      setServiceDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(
        editingServiceId ? "Failed to update service" : "Failed to add service"
      );
    } finally {
      setSavingService(false);
    }
  };

  const deleteService = async (service: Service) => {
    if (!canManageServices) {
      toast.error("You do not have permission to delete services.");
      return;
    }
    if (!window.confirm(`Delete ${service.type} service?`)) return;

    try {
      setDeletingServiceId(service.id);
      const accounting = await getFreshServiceAccounting(service.id);
      if (accounting.status === "confirmed") {
        toast.error("Confirmed services cannot be deleted.");
        return;
      }

      await deleteDoc(
        doc(db, "salesOrders", id as string, "services", service.id)
      );

      if (accounting?.entryIds.length) {
        await Promise.all(
          accounting.entryIds.map((entryId) =>
            deleteDoc(doc(db, "accountingEntries", entryId))
          )
        );
      }

      const nextServices = services.filter((item) => item.id !== service.id);
      await recalculateOrderTotals(nextServices);
      setServices(nextServices);
      setServiceAccounting((prev) => {
        const next = { ...prev };
        delete next[service.id];
        return next;
      });
      toast.success("Service deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete service");
    } finally {
      setDeletingServiceId(null);
    }
  };

  const calculatePaymentMethodFee = (
    amount: number,
    percentageRate: number,
    fixedFee: number
  ) => {
    if (safeNum(amount) <= 0) return 0;
    const fee = safeNum(amount) * (safeNum(percentageRate) / 100) + safeNum(fixedFee);
    return Math.round(fee * 100) / 100;
  };

  const syncAccountingAttachment = async (
    itemId: string,
    kind: "service" | "payment",
    file: UploadedFile
  ) => {
    const fieldName = kind === "service" ? "serviceId" : "paymentId";
    const entriesQuery = query(
      collection(db, "accountingEntries"),
      where("orderId", "==", id as string)
    );
    const entriesSnap = await getDocs(entriesQuery);

    await Promise.all(
      entriesSnap.docs
        .filter((entryDoc) => entryDoc.data()?.[fieldName] === itemId)
        .map((entryDoc) =>
          updateDoc(doc(db, "accountingEntries", entryDoc.id), {
            file,
            updatedAt: serverTimestamp(),
          })
        )
    );
  };

  const uploadOrderFile = async (
    kind: "service" | "payment",
    itemId: string,
    file: File
  ) => {
    const key = `${kind}-${itemId}`;
    const folder = kind === "service" ? "services" : "payments";
    const fieldName = kind === "service" ? "invoiceFile" : "receiptFile";
    const pathPart = kind === "service" ? "invoice" : "receipt";
    const filePath = `salesOrders/${id}/${folder}/${itemId}/${pathPart}/${Date.now()}-${file.name}`;

    try {
      setUploadingKey(key);
      if (kind === "service") {
        const accounting = await getFreshServiceAccounting(itemId);
        if (accounting.status === "confirmed") {
          toast.error("Confirmed services cannot be changed.");
          return;
        }
      }

      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const uploadedFile = {
        name: file.name,
        url,
        path: filePath,
      };

      await updateDoc(doc(db, "salesOrders", id as string, folder, itemId), {
        [fieldName]: uploadedFile,
        updatedAt: serverTimestamp(),
      });

      await syncAccountingAttachment(itemId, kind, uploadedFile);

      if (kind === "service") {
        setServices((prev) =>
          prev.map((service) =>
            service.id === itemId
              ? { ...service, invoiceFile: uploadedFile }
              : service
          )
        );
      } else {
        setPayments((prev) =>
          prev.map((payment) =>
            payment.id === itemId
              ? { ...payment, receiptFile: uploadedFile }
              : payment
          )
        );
      }

      toast.success("Attachment uploaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload attachment");
    } finally {
      setUploadingKey(null);
    }
  };

  const addCustomerPayment = async () => {
    if (!order) return;

    const amount = safeNum(paymentAmount);
    const currentPaid = safeNum(order.paidAmount);
    const fullAmount = safeNum(order.fullAmount ?? order.totalPrice);
    const currentRemaining = safeNum(order.remainingAmount ?? fullAmount - currentPaid);

    if (amount <= 0) {
      toast.error("Enter a payment amount.");
      return;
    }

    if (!paymentMethodId) {
      toast.error("Select a payment method.");
      return;
    }

    if (!receiptFile) {
      toast.error("Receipt upload is required.");
      return;
    }

    if (amount > currentRemaining) {
      toast.error("Payment cannot exceed the remaining amount.");
      return;
    }

    try {
      setSavingPayment(true);
      const paymentMethodFeeAmount = calculatePaymentMethodFee(
        amount,
        paymentMethodPercentageRate,
        paymentMethodFixedFee
      );

      const paymentRef = await addDoc(
        collection(db, "salesOrders", id as string, "payments"),
        {
          amount,
          paymentMethodId,
          paymentMethodName,
          paymentMethodPercentageRate,
          paymentMethodFixedFee,
          paymentMethodFeeAmount,
          note: paymentNote.trim(),
          receiptFile: null,
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
        }
      );

      const filePath = `salesOrders/${id}/payments/${paymentRef.id}/receipt/${Date.now()}-${receiptFile.name}`;
      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, receiptFile);
      const url = await getDownloadURL(fileRef);
      const uploadedFile = {
        name: receiptFile.name,
        url,
        path: filePath,
      };

      await updateDoc(paymentRef, {
        receiptFile: uploadedFile,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "accountingEntries"), {
        orderId: id as string,
        customerId: order.customerId,
        direction: "in",
        sourceType: "customer_payment",
        amount,
        currency: "SAR",
        orderNumber: order.orderNumber || null,
        paymentMethodId,
        paymentMethodName,
        paymentMethodPercentageRate,
        paymentMethodFixedFee,
        paymentMethodFeeAmount,
        description: paymentNote.trim() || "Customer payment",
        file: uploadedFile,
        status: "pending",
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
        confirmedBy: null,
        confirmedAt: null,
        paymentId: paymentRef.id,
      });

      if (paymentMethodFeeAmount > 0) {
        await addDoc(collection(db, "accountingEntries"), {
          orderId: id as string,
          customerId: order.customerId,
          direction: "out",
          sourceType: "payment_method_fee",
          amount: paymentMethodFeeAmount,
          currency: "SAR",
          orderNumber: order.orderNumber || null,
          paymentMethodId,
          paymentMethodName,
          paymentMethodPercentageRate,
          paymentMethodFixedFee,
          paymentMethodFeeAmount,
          description: `Payment method fee - ${paymentMethodName}`,
          file: uploadedFile,
          status: "pending",
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
          confirmedBy: null,
          confirmedAt: null,
          paymentId: paymentRef.id,
        });
      }

      const paidAmount = currentPaid + amount;
      const remainingAmount = fullAmount - paidAmount;

      await updateDoc(doc(db, "salesOrders", id as string), {
        paidAmount,
        remainingAmount,
        updatedAt: serverTimestamp(),
      });

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              paidAmount,
              remainingAmount,
              fullAmount,
            }
          : prev
      );
      setPayments((prev) => [
        {
          id: paymentRef.id,
          amount,
          paymentMethodName,
          paymentMethodFeeAmount,
          note: paymentNote.trim(),
          receiptFile: uploadedFile,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        },
        ...prev,
      ]);
      setPaymentAmount(0);
      setPaymentMethodId("");
      setPaymentMethodName("");
      setPaymentMethodPercentageRate(0);
      setPaymentMethodFixedFee(0);
      setPaymentNote("");
      setReceiptFile(null);
      toast.success("Customer payment added");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add customer payment");
    } finally {
      setSavingPayment(false);
    }
  };

  if (authLoading || !user || loading) {
    return (
      <ProtectedRouteWithPrivilege requiredPrivilege="sales.view">
        <LoadingProgress />
      </ProtectedRouteWithPrivilege>
    );
  }

  if (!order) {
    return (
      <ProtectedRouteWithPrivilege requiredPrivilege="sales.view">
        <div className="p-6 text-center text-sm text-muted-foreground">
          Order not found.
        </div>
      </ProtectedRouteWithPrivilege>
    );
  }

  const fullAmount = safeNum(order.fullAmount ?? order.totalPrice);
  const paidAmount = safeNum(order.paidAmount);
  const remainingAmount = safeNum(order.remainingAmount ?? fullAmount - paidAmount);
  const orderId = id as string;
  const orderNumber = order.orderNumber || orderId;
  const paidPercent =
    fullAmount > 0 ? Math.min(100, Math.round((paidAmount / fullAmount) * 100)) : 0;
  const paymentFee = calculatePaymentMethodFee(
    paymentAmount,
    paymentMethodPercentageRate,
    paymentMethodFixedFee
  );
  const confirmedServicesCount = services.filter((service) =>
    isServiceConfirmed(service.id)
  ).length;
  const formatMoney = (value: any) =>
    `${safeNum(value).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })} SAR`;
  const createdAtLabel = order.createdAt?.seconds
    ? format(new Date(order.createdAt.seconds * 1000), "yyyy-MM-dd HH:mm")
    : "-";

  const metricCard = (
    label: string,
    value: string,
    icon: ReactNode,
    tone: string
  ) => (
    <Card className="border bg-background shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-xl font-semibold">{value}</div>
        </div>
        <div className={`rounded-md p-2 ${tone}`}>{icon}</div>
      </CardContent>
    </Card>
  );

  const attachmentState = (file: UploadedFile, label: string) => {
    if (file?.url) {
      return (
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <FileText className="h-3.5 w-3.5 text-emerald-600" />
          {label}
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </a>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-950/40">
        <FileWarning className="h-3.5 w-3.5" />
        Missing {label}
      </span>
    );
  };

  const uploadControl = (
    kind: "service" | "payment",
    itemId: string,
    label: string,
    disabled = false
  ) => {
    const key = `${kind}-${itemId}`;

    return (
      <Input
        type="file"
        className="h-9 max-w-[220px] text-xs"
        disabled={disabled || uploadingKey === key}
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          uploadOrderFile(kind, itemId, file);
          event.currentTarget.value = "";
        }}
      />
    );
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="sales.view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* HEADER */}
          <header className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h2 className="font-semibold">Sales Order Details</h2>
            </div>
            <ThemeToggle />
          </header>

          <div className="min-h-screen bg-muted/10">
            <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
              <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/sales")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Badge variant="secondary" className="capitalize">
                      {order.status}
                    </Badge>
                  </div>
                  <h1 className="mt-3 text-2xl font-semibold tracking-normal">
                    Sales Order
                  </h1>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="max-w-xl truncate">Order ID: {orderNumber}</span>
                    <span>Created: {createdAtLabel}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {order.status !== "approved" && (
                    <Button size="sm" onClick={() => updateStatus("approved")}>
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </Button>
                  )}
                  {order.status !== "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus("completed")}
                    >
                      <Clock className="h-4 w-4" />
                      Complete
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                {metricCard(
                  "Full Amount",
                  formatMoney(fullAmount),
                  <WalletCards className="h-5 w-5" />,
                  "bg-sky-50 text-sky-700 dark:bg-sky-950/40"
                )}
                {metricCard(
                  "Paid",
                  formatMoney(paidAmount),
                  <CircleDollarSign className="h-5 w-5" />,
                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                )}
                {metricCard(
                  "Remaining",
                  formatMoney(remainingAmount),
                  <CreditCard className="h-5 w-5" />,
                  "bg-amber-50 text-amber-700 dark:bg-amber-950/40"
                )}
                {metricCard(
                  "Total Cost",
                  formatMoney(order.totalCost),
                  <ReceiptText className="h-5 w-5" />,
                  "bg-rose-50 text-rose-700 dark:bg-rose-950/40"
                )}
                {metricCard(
                  "Profit",
                  formatMoney(order.totalProfit),
                  <CheckCircle className="h-5 w-5" />,
                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
                <div className="space-y-5">
                  <Card className="border bg-background shadow-sm">
                    <CardHeader className="border-b bg-muted/20 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <PlaneTakeoff className="h-4 w-4 text-muted-foreground" />
                            Services
                          </CardTitle>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {confirmedServicesCount} confirmed / {services.length} total
                          </div>
                        </div>
                        {canManageServices ? (
                          <Button size="sm" onClick={openAddService}>
                            <Plus className="h-4 w-4" />
                            Add Service
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {services.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground">
                          No services found.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[1080px] text-sm">
                            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium">
                                  Service
                                </th>
                                <th className="px-4 py-3 text-left font-medium">
                                  Description
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                  Cost
                                </th>
                                <th className="px-4 py-3 text-left font-medium">
                                  Accounting
                                </th>
                                <th className="px-4 py-3 text-left font-medium">
                                  Invoice
                                </th>
                                <th className="px-4 py-3 text-left font-medium">
                                  Upload
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {services.map((s) => {
                                const confirmed = isServiceConfirmed(s.id);

                                return (
                                  <tr
                                    key={s.id}
                                    className="border-t transition-colors hover:bg-muted/20"
                                  >
                                    <td className="px-4 py-4 font-medium">
                                      {s.type}
                                    </td>
                                    <td className="px-4 py-4 text-muted-foreground">
                                      {s.description || "-"}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      {formatMoney(s.cost)}
                                    </td>
                                    <td className="px-4 py-4">
                                      <Badge
                                        variant={confirmed ? "default" : "secondary"}
                                        className={
                                          confirmed
                                            ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                            : ""
                                        }
                                      >
                                        {confirmed ? (
                                          <LockKeyhole className="mr-1 h-3.5 w-3.5" />
                                        ) : (
                                          <Clock className="mr-1 h-3.5 w-3.5" />
                                        )}
                                        {confirmed ? "Confirmed" : "Pending"}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-4">
                                      {attachmentState(
                                        s.invoiceFile || null,
                                        "Invoice"
                                      )}
                                    </td>
                                    <td className="px-4 py-4">
                                      {confirmed ? (
                                        <span className="text-xs text-muted-foreground">
                                          Locked
                                        </span>
                                      ) : (
                                        uploadControl(
                                          "service",
                                          s.id,
                                          "Upload Invoice",
                                          !canManageServices
                                        )
                                      )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      {confirmed ? (
                                        <span className="text-xs font-medium text-emerald-600">
                                          Confirmed by Accounting
                                        </span>
                                      ) : canManageServices ? (
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => openEditService(s)}
                                            title="Edit service"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => deleteService(s)}
                                            disabled={deletingServiceId === s.id}
                                            title="Delete service"
                                            className="text-rose-600 hover:text-rose-700"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">
                                          No permission
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border bg-background shadow-sm">
                    <CardHeader className="border-b bg-muted/20 px-4 py-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ReceiptText className="h-4 w-4 text-muted-foreground" />
                        Customer Payments
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] text-sm">
                          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left font-medium">
                                Method
                              </th>
                              <th className="px-4 py-3 text-right font-medium">
                                Amount
                              </th>
                              <th className="px-4 py-3 text-right font-medium">
                                Fee
                              </th>
                              <th className="px-4 py-3 text-left font-medium">
                                Receipt
                              </th>
                              <th className="px-4 py-3 text-left font-medium">
                                Upload
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="px-4 py-8 text-center text-muted-foreground"
                                >
                                  No customer payments found.
                                </td>
                              </tr>
                            ) : (
                              payments.map((payment) => (
                                <tr
                                  key={payment.id}
                                  className="border-t transition-colors hover:bg-muted/20"
                                >
                                  <td className="px-4 py-4 text-muted-foreground">
                                    {payment.createdAt?.seconds
                                      ? format(
                                          new Date(payment.createdAt.seconds * 1000),
                                          "yyyy-MM-dd"
                                        )
                                      : "-"}
                                  </td>
                                  <td className="px-4 py-4">
                                    {payment.paymentMethodName || "-"}
                                  </td>
                                  <td className="px-4 py-4 text-right font-semibold text-emerald-600">
                                    {formatMoney(payment.amount)}
                                  </td>
                                  <td className="px-4 py-4 text-right">
                                    {formatMoney(payment.paymentMethodFeeAmount)}
                                  </td>
                                  <td className="px-4 py-4">
                                    {attachmentState(
                                      payment.receiptFile || null,
                                      "Receipt"
                                    )}
                                  </td>
                                  <td className="px-4 py-4">
                                    {uploadControl(
                                      "payment",
                                      payment.id,
                                      "Upload Receipt"
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border bg-background shadow-sm">
                    <CardHeader className="border-b bg-muted/20 px-4 py-3">
                      <CardTitle className="text-base">Add Customer Payment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div>
                          <Label className="my-2">Amount (SAR)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={paymentAmount}
                            onChange={(e) =>
                              setPaymentAmount(safeNum(e.target.value))
                            }
                          />
                        </div>

                        <div>
                          <Label className="my-2">Payment Method</Label>
                          <select
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                            value={paymentMethodId}
                            onChange={(e) => {
                              const selected = paymentMethods.find(
                                (method) => method.id === e.target.value
                              );
                              setPaymentMethodId(selected?.id || "");
                              setPaymentMethodName(selected?.name || "");
                              setPaymentMethodPercentageRate(
                                safeNum(selected?.percentageRate)
                              );
                              setPaymentMethodFixedFee(safeNum(selected?.fixedFee));
                            }}
                          >
                            <option value="">
                              {paymentMethods.length
                                ? "Select method"
                                : "No methods available"}
                            </option>
                            {paymentMethods.map((method) => (
                              <option key={method.id} value={method.id}>
                                {method.name}
                              </option>
                            ))}
                          </select>
                          {paymentMethodId && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Fee: {formatMoney(paymentFee)} (
                              {paymentMethodPercentageRate}% +{" "}
                              {paymentMethodFixedFee} SAR)
                            </p>
                          )}
                        </div>

                        <div>
                          <Label className="my-2">Note</Label>
                          <Input
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            placeholder="Customer payment"
                          />
                        </div>

                        <div>
                          <Label className="my-2">Receipt</Label>
                          <Input
                            type="file"
                            onChange={(e) =>
                              setReceiptFile(e.target.files?.[0] ?? null)
                            }
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                          Payment progress: {paidPercent}%
                        </div>
                        <Button onClick={addCustomerPayment} disabled={savingPayment}>
                          <Upload className="h-4 w-4" />
                          {savingPayment ? "Saving..." : "Add Payment"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-5">
                  <Card className="border bg-background shadow-sm">
                    <CardHeader className="border-b bg-muted/20 px-4 py-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                        Customer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Name</div>
                        <div className="font-semibold">{customer?.name || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Phone</div>
                        <div>{customer?.phone || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Nationality
                        </div>
                        <div>{customer?.nationality || "-"}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border bg-background shadow-sm">
                    <CardHeader className="border-b bg-muted/20 px-4 py-3">
                      <CardTitle className="text-base">Payment Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4">
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${paidPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Paid</span>
                        <span className="font-semibold">{formatMoney(paidAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Remaining</span>
                        <span className="font-semibold">
                          {formatMoney(remainingAmount)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <Dialog
        open={serviceDialogOpen}
        onOpenChange={(open) => {
          setServiceDialogOpen(open);
          if (!open) setEditingServiceId(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingServiceId ? "Edit Service" : "Add Service"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Add or update a pending service for this sales order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="service-type">Service Type</Label>
                <select
                  id="service-type"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={serviceDraft.type}
                  onChange={(event) =>
                    setServiceDraft((prev) => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                >
                  {!SERVICE_TYPES.includes(
                    serviceDraft.type as (typeof SERVICE_TYPES)[number]
                  ) && serviceDraft.type ? (
                    <option value={serviceDraft.type}>{serviceDraft.type}</option>
                  ) : null}
                  {SERVICE_TYPES.map((serviceType) => (
                    <option key={serviceType} value={serviceType}>
                      {serviceType}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="service-qty">Quantity</Label>
                <Input
                  id="service-qty"
                  type="number"
                  min={1}
                  value={serviceDraft.qty}
                  onChange={(event) =>
                    setServiceDraft((prev) => ({
                      ...prev,
                      qty: Math.max(1, safeNum(event.target.value)),
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="service-description">Description</Label>
              <Textarea
                id="service-description"
                value={serviceDraft.description}
                onChange={(event) =>
                  setServiceDraft((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Service details"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="service-unit-cost">Unit Cost (SAR)</Label>
                <Input
                  id="service-unit-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={serviceDraft.unitCost}
                  onChange={(event) =>
                    setServiceDraft((prev) => ({
                      ...prev,
                      unitCost: safeNum(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Total Cost</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/20 px-3 text-sm font-semibold">
                  {formatMoney(
                    Math.max(1, safeNum(serviceDraft.qty)) *
                      safeNum(serviceDraft.unitCost)
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="service-invoice">
                Invoice {editingServiceId ? "(optional replacement)" : "(optional)"}
              </Label>
              <Input
                id="service-invoice"
                type="file"
                onChange={(event) =>
                  setServiceDraft((prev) => ({
                    ...prev,
                    invoiceFile: event.target.files?.[0] || null,
                  }))
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setServiceDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={saveService} disabled={savingService}>
                <Save className="h-4 w-4" />
                {savingService
                  ? "Saving..."
                  : editingServiceId
                    ? "Save Changes"
                    : "Add Service"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedRouteWithPrivilege>
  );
}

import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import "./classes/Sales.css";

function Sales() {
  // Container 1: Order Metadata
  const [saleType, setSaleType] = useState("retail");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [taxType, setTaxType] = useState("gst");

  // Dynamic Sequential Tracking State
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // API Data States
  const [backendProducts, setBackendProducts] = useState([]);
  const [backendCustomers, setBackendCustomers] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Container 2: Product Search & Barcode
  const [productSearch, setProductSearch] = useState("");
  const [searchQuantity, setSearchQuantity] = useState(1);

  // Table State
  const [cart, setCart] = useState([]);

  // --- COMPONENT ENGINE: DISPATCH NEXT INVOICE NUMBER ---
  const generateNextInvoice = async () => {
    try {
      // Fetching the next chronological invoice tracking number from Yii2
      const response = await fetch("http://localhost:8080/api/sales/next-invoice");
      const data = await response.json();
      
      // Assumes structure: { invoice_number: "INV-2026-00042" }
      setInvoiceNumber(data.invoice_number || `INV-${Date.now().toString().slice(-5)}`);
    } catch (error) {
      console.error("Error generating invoice sequence number:", error);
      // Fallback tracking stamp to keep terminal unblocked if backend blips
      setInvoiceNumber(`INV-TMP-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  };

  // --- FETCH CONFIG DATA & INVOICE ON LAUNCH ---
  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        setIsLoadingData(true);
        
        const prodResponse = await fetch("http://localhost:8080/api/products");
        const prodData = await prodResponse.json();
        
        const custResponse = await fetch("http://localhost:8080/api/customers");
        const custData = await custResponse.json();

        setBackendProducts(prodData);
        setBackendCustomers(custData);
        
        // Load the initial invoice number for the current sale session
        await generateNextInvoice();
      } catch (error) {
        console.error("Error connecting to Yii2 backend API:", error);
        alert("Failed to load terminal configuration parameters from server.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchBackendData();
  }, []);

  // --- HARDWARE BARCODE SCANNING INTEGRATION ---
  useEffect(() => {
    let barcodeString = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      const currentTime = Date.now();
      
      if (currentTime - lastKeyTime > 100) {
        barcodeString = ""; 
      }
      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (barcodeString.length > 3) {
          handleBarcodeScanned(barcodeString);
          barcodeString = "";
          e.preventDefault();
        }
      } else if (e.key !== "Shift") {
        barcodeString += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [backendProducts, cart]);

  const handleBarcodeScanned = (code) => {
    const product = backendProducts.find((p) => String(p.barcode) === String(code));
    if (product) {
      addToCart(product, 1);
    } else {
      console.log(`Scanned Barcode "${code}" matches no active item.`);
    }
  };

  // --- CART MUTATIONS ---
  const addToCart = (product, qty) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingIndex].quantity += qty;
        return newCart;
      } else {
        return [...prevCart, { ...product, quantity: qty, cost: Number(product.cost) }];
      }
    });
  };

  const handleAddLine = () => {
    if (!productSearch) return;
    
    const product = backendProducts.find((p) => String(p.id) === String(productSearch));
    if (product) {
      addToCart(product, Number(searchQuantity));
      setProductSearch("");
      setSearchQuantity(1);
    }
  };

  const updateQuantity = (id, val) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, Number(val)) } : item))
    );
  };

  const updateCost = (id, val) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, cost: Math.max(0, Number(val)) } : item))
    );
  };

  const removeItem = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // --- MATH CALCULATION MATRIX ---
  const totals = cart.reduce(
    (acc, item) => {
      const lineTotalWithTax = item.cost * item.quantity;
      const basePrice = lineTotalWithTax / (1 + Number(item.taxRate || 0.18));
      const taxAmount = lineTotalWithTax - basePrice;

      acc.subtotal += lineTotalWithTax;
      acc.totalTax += taxAmount;
      return acc;
    },
    { subtotal: 0, totalTax: 0 }
  );

  const grandTotal = totals.subtotal;

  // --- YII2 BACKEND SAVE CONTROLLER ROUTER ---
  const saveSaleToBackend = async (shouldPrint = false) => {
    if (cart.length === 0) return alert("Cart is empty!");

    const salePayload = {
      invoice_number: invoiceNumber, // Included directly inside root schema data mapping
      sale_type: saleType,
      customer_id: selectedCustomerId || null,
      payment_type: paymentType,
      tax_type: taxType,
      subtotal: totals.subtotal.toFixed(2),
      total_tax: totals.totalTax.toFixed(2),
      grand_total: grandTotal.toFixed(2),
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        unit_cost: item.cost,
        line_total: (item.cost * item.quantity).toFixed(2)
      }))
    };

    try {
      const response = await fetch("http://localhost:8080/api/sales/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(salePayload),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Transaction processed and saved under reference ${invoiceNumber}! ✅`);
        
        if (shouldPrint) {
          window.print(); 
        }
        
        // Reset cart grid ecosystem
        setCart([]);
        setSelectedCustomerId("");
        
        // Regenerate next distinct consecutive invoice layout string assignment instantly
        await generateNextInvoice();
      } else {
        alert(`Server validation error: ${data.message || "Failed to compile sale record."}`);
      }
    } catch (error) {
      console.error("Failed executing post operation:", error);
      alert("Network exception communicating with Yii2 API endpoint.");
    }
  };

  const handleCancel = () => {
    if (window.confirm("Are you sure you want to clear this sale?")) {
      setCart([]);
      setSelectedCustomerId("");
      // Refreshes the serial assignment key signature automatically
      generateNextInvoice();
    }
  };

  const getSelectedCustomerName = () => {
    const cust = backendCustomers.find(c => String(c.id) === String(selectedCustomerId));
    return cust ? cust.name : "Walk-in Customer";
  };

  return (
    <div className="sales-wrapper">
     <Helmet>
        <title>POS System - Sales</title>
        <meta name="description" content="Real-time retail and wholesale billing application terminal." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </Helmet>
      {isLoadingData ? (
        <div className="no-print" style={{textAlign: "center", padding: "40px", color: "#201e45", fontWeight: "bold"}}>
          Loading POS Configuration Data from Yii2 API...
        </div>
      ) : (
        <div className="sales-layout no-print">
          
          {/* INVOICE NUMBER META DISPLAY HEADER HEADER BANNER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#201e45", padding: "12px 24px", borderRadius: "8px", color: "white" }}>
            <h2 style={{ margin: 0, fontSize: "18px" }}>Sales Billing</h2>
            <div style={{ fontSize: "16px", fontWeight: "600", background: "#404267", padding: "6px 14px", borderRadius: "4px" }}>
              Current Invoice: <span style={{ color: "#f07b7b" }}>{invoiceNumber}</span>
            </div>
          </div>

          {/* CONTAINER 1: META SYSTEM METADATA */}
          <div className="sales-container meta-box">
            <div className="form-group">
              <label>Sale Type</label>
              <select value={saleType} onChange={(e) => setSaleType(e.target.value)}>
                <option value="retail">Retail Sale</option>
                <option value="wholesale">Wholesale Sale</option>
              </select>
            </div>

            <div className="form-group">
              <label>Select Customer</label>
              <select 
                value={selectedCustomerId} 
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">-- Walk-in Client --</option>
                {backendCustomers.map((cust) => (
                  <option key={cust.id} value={cust.id}>{cust.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Payment Method</label>
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            <div className="form-group">
              <label>Tax Configuration</label>
              <select value={taxType} onChange={(e) => setTaxType(e.target.value)}>
                <option value="gst">GST (Single Slab)</option>
                <option value="cgst_sgst">CGST + SGST</option>
              </select>
            </div>
          </div>

          {/* CONTAINER 2: DYNAMIC SALES PROCESSING LAYOUT */}
          <div className="sales-container processing-box">
            <div className="product-search-row">
              <div className="form-group search-input">
                <label>Select Product (or scan barcode directly)</label>
                <select 
                  value={productSearch} 
                  onChange={(e) => setProductSearch(e.target.value)}
                >
                  <option value="">-- Select Product Line item --</option>
                  {backendProducts.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} (₹{Number(prod.cost).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group qty-counter">
                <label>Quantity</label>
                <div className="counter-controls">
                  <button type="button" onClick={() => setSearchQuantity(Math.max(1, searchQuantity - 1))}>-</button>
                  <input
                    type="number"
                    value={searchQuantity}
                    onChange={(e) => setSearchQuantity(Math.max(1, Number(e.target.value)))}
                  />
                  <button type="button" onClick={() => setSearchQuantity(searchQuantity + 1)}>+</button>
                </div>
              </div>

              <button type="button" className="add-line-btn" onClick={handleAddLine}>
                Add Line Item
              </button>
            </div>

            {/* LIVE LINE ITEM RECORDS GRAPH */}
            <div className="table-responsive">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Product Details</th>
                    <th style={{ width: "100px" }}>Qty</th>
                    <th style={{ width: "120px" }}>Unit Cost (Inc. Tax)</th>
                    <th style={{ width: "100px" }}>Total</th>
                    <th style={{ width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty-row">No line items added yet. Scanning hardware active.</td>
                    </tr>
                  ) : (
                    cart.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="prod-title">{item.name}</div>
                          <small className="barcode-tag">BC: {item.barcode}</small>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="table-input"
                            value={item.quantity}
                            min="1"
                            onChange={(e) => updateQuantity(item.id, e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="table-input"
                            value={item.cost}
                            min="0"
                            onChange={(e) => updateCost(item.id, e.target.value)}
                          />
                        </td>
                        <td>₹{(item.cost * item.quantity).toFixed(2)}</td>
                        <td>
                          <button type="button" className="row-del-btn" onClick={() => removeItem(item.id)}>&times;</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* BALANCE TOTAL SHEET BLOCK */}
            <div className="summary-section">
              <div className="summary-block">
                <div className="summary-row">
                  <span>Subtotal (Tax Inclusive):</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="summary-row tax-breakdown">
                  {taxType === "gst" ? (
                    <>
                      <span>Total Tax Breakdown (GST):</span>
                      <span>₹{totals.totalTax.toFixed(2)}</span>
                    </>
                  ) : (
                    <>
                      <span>Tax Breakdown (CGST 50% / SGST 50%):</span>
                      <span>₹{(totals.totalTax / 2).toFixed(2)} + ₹{(totals.totalTax / 2).toFixed(2)}</span>
                    </>
                  )}
                </div>
                <div className="summary-row grand-total">
                  <span>Grand Total:</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* APP FOOTER ACTION ENGINE BUTTONS */}
            <div className="actions-section">
              <button type="button" className="btn btn-cancel" onClick={handleCancel}>Cancel Order</button>
              <button type="button" className="btn btn-save" onClick={() => saveSaleToBackend(false)}>Save Order</button>
              <button type="button" className="btn btn-print" onClick={() => saveSaleToBackend(true)}>Save & Print Bill</button>
            </div>
          </div>
        </div>
      )}

      {/* --- HIDDEN 2-INCH CONTINUOUS RECEIPT STRIP --- */}
      <div className="thermal-receipt-strip print-only">
        <div className="receipt-header">
          <h3>POS SYSTEM BILL</h3>
          <p>Tax Invoice ({saleType.toUpperCase()})</p>
        </div>
        <div className="receipt-meta">
          <div>Invoice: <strong>{invoiceNumber}</strong></div> {/* Renders real-time generated tracking serial */}
          <div>Date: {new Date().toLocaleDateString()}</div>
          <div>Customer: {getSelectedCustomerName()}</div>
          <div>Pay Mode: {paymentType.toUpperCase()}</div>
        </div>
        <div className="receipt-divider">--------------------------------</div>
        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.quantity}</td>
                <td>₹{(item.cost * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="receipt-divider">--------------------------------</div>
        <div className="receipt-summary">
          <div className="receipt-row"><span>Subtotal (Inc. Tax):</span> <span>₹{totals.subtotal.toFixed(2)}</span></div>
          {taxType === "gst" ? (
            <div className="receipt-row"><span>Total GST:</span> <span>₹{totals.totalTax.toFixed(2)}</span></div>
          ) : (
            <>
              <div className="receipt-row"><span>CGST:</span> <span>₹{(totals.totalTax / 2).toFixed(2)}</span></div>
              <div className="receipt-row"><span>SGST:</span> <span>₹{(totals.totalTax / 2).toFixed(2)}</span></div>
            </>
          )}
          <div className="receipt-row receipt-grand"><span>GRAND TOTAL:</span> <span>₹{grandTotal.toFixed(2)}</span></div>
        </div>
        <div className="receipt-footer">
          <p>Thank You! Please Visit Again.</p>
        </div>
      </div>
    </div>
  );
}

export default Sales;
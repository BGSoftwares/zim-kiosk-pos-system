from decimal import Decimal
from django.db import transaction

from apps.inventory.models import Inventory, StockTransaction
from apps.payments.models import Payment
from .models import Sale, SaleItem

ALLOWED_CURRENCIES = {"USD", "ZIG", "ZAR"}


@transaction.atomic
def create_sale(*, cashier, branch, currency, exchange_rate, items, payments, idempotency_key, receipt_number, discount=Decimal("0")):
    existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        return existing

    currency = currency.upper()
    if currency not in ALLOWED_CURRENCIES:
        raise ValueError("Unsupported currency")

    subtotal = Decimal("0")
    prepared = []
    seen_products = set()

    for item in items:
        product_id = int(item["product_id"])
        if product_id in seen_products:
            raise ValueError("A product may only appear once in a sale")
        seen_products.add(product_id)

        inventory = Inventory.objects.select_for_update().select_related("product").get(product_id=product_id, branch=branch)
        quantity = Decimal(str(item["quantity"]))
        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero")
        if inventory.quantity < quantity:
            raise ValueError(f"Insufficient stock for product {product_id}")

        unit_price = inventory.product.selling_price
        line_total = (unit_price * quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        prepared.append((inventory, quantity, unit_price, line_total))

    discount = Decimal(str(discount)).quantize(Decimal("0.01"))
    if discount < 0 or discount > subtotal:
        raise ValueError("Invalid discount")

    total = (subtotal - discount).quantize(Decimal("0.01"))
    payment_total = sum((Decimal(str(p["amount"])) for p in payments), Decimal("0")).quantize(Decimal("0.01"))
    if payment_total != total:
        raise ValueError("Payment total must exactly match the sale total")

    sale = Sale.objects.create(
        receipt_number=receipt_number,
        branch=branch,
        cashier=cashier,
        currency=currency,
        exchange_rate=exchange_rate,
        subtotal=subtotal,
        discount=discount,
        tax=Decimal("0"),
        total=total,
        idempotency_key=idempotency_key,
    )

    for inventory, quantity, unit_price, line_total in prepared:
        SaleItem.objects.create(
            sale=sale,
            product=inventory.product,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        inventory.quantity -= quantity
        inventory.save(update_fields=["quantity", "updated_at"])
        StockTransaction.objects.create(
            inventory=inventory,
            transaction_type=StockTransaction.Type.SALE,
            quantity=-quantity,
            reference=sale.receipt_number,
            created_by=cashier,
        )

    for payment in payments:
        amount = Decimal(str(payment["amount"])).quantize(Decimal("0.01"))
        Payment.objects.create(
            sale=sale,
            method=payment["method"],
            amount=amount,
            currency=payment.get("currency", currency).upper(),
            reference=payment.get("reference", ""),
        )

    return sale

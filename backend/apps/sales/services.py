from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction

from apps.debtors.models import Debtor, DebtorTransaction
from apps.inventory.models import Inventory, StockTransaction
from apps.payments.models import Payment
from .models import Sale, SaleItem

ALLOWED_CURRENCIES = {"USD", "ZIG", "ZAR"}
PAYMENT_METHODS = {"CASH", "ECOCASH", "CARD", "BANK", "CREDIT"}
CENT = Decimal("0.01")


def money(value):
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def positive_rate(value):
    result = Decimal(str(value))
    if result <= 0:
        raise ValueError("Exchange rate must be greater than zero")
    return result


@transaction.atomic
def create_sale(*, cashier, branch, currency, exchange_rate, items, payments, idempotency_key, receipt_number, discount=Decimal("0"), debtor_id=None):
    if not idempotency_key:
        raise ValueError("Idempotency key is required")

    existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        return existing

    currency = str(currency).upper()
    if currency not in ALLOWED_CURRENCIES:
        raise ValueError("Unsupported currency")
    exchange_rate = positive_rate(exchange_rate)
    if not items:
        raise ValueError("A sale must contain at least one item")
    if not payments:
        raise ValueError("A sale must contain at least one payment")

    subtotal = Decimal("0")
    prepared = []
    seen_products = set()

    for item in items:
        product_id = int(item["product_id"])
        if product_id in seen_products:
            raise ValueError("A product may only appear once in a sale")
        seen_products.add(product_id)

        try:
            inventory = Inventory.objects.select_for_update().select_related("product").get(
                product_id=product_id, branch=branch
            )
        except ObjectDoesNotExist:
            raise ValueError(f"Product {product_id} has no inventory record at this branch")

        quantity = Decimal(str(item["quantity"]))
        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero")
        if inventory.quantity < quantity:
            raise ValueError(f"Insufficient stock for product {product_id}")

        unit_price = money(inventory.product.selling_price)
        line_total = money(unit_price * quantity)
        subtotal += line_total
        prepared.append((inventory, quantity, unit_price, line_total))

    discount = money(discount)
    if discount < 0 or discount > subtotal:
        raise ValueError("Invalid discount")
    total = money(subtotal - discount)

    normalized_payments = []
    payment_total = Decimal("0")
    credit_amount = Decimal("0")

    for payment in payments:
        method = str(payment["method"]).upper()
        if method not in PAYMENT_METHODS:
            raise ValueError(f"Unsupported payment method: {method}")

        amount = money(payment["amount"])
        if amount <= 0:
            raise ValueError("Payment amount must be greater than zero")

        payment_currency = str(payment.get("currency", currency)).upper()
        if payment_currency not in ALLOWED_CURRENCIES:
            raise ValueError("Unsupported payment currency")

        payment_rate = positive_rate(payment.get("exchange_rate", exchange_rate))
        converted = amount if payment_currency == currency else money(amount * payment_rate / exchange_rate)
        payment_total += converted

        if method == Payment.Method.CREDIT:
            if payment_currency != currency:
                raise ValueError("Credit payments must use the sale currency")
            credit_amount += converted

        normalized_payments.append((method, amount, payment_currency, payment_rate, payment.get("reference", "")))

    if payment_total != total:
        raise ValueError("Payment total must exactly match the sale total after currency conversion")

    if credit_amount > 0:
        if debtor_id is None:
            raise ValueError("A debtor is required for credit payments")
        try:
            debtor = Debtor.objects.select_for_update().get(id=debtor_id, branch=branch, is_active=True)
        except Debtor.DoesNotExist:
            raise ValueError("Debtor does not exist at this branch")

        existing_balance = sum(
            (
                t.amount if t.transaction_type == DebtorTransaction.Type.SALE else -t.amount
                for t in debtor.transactions.filter(currency=currency)
            ),
            Decimal("0"),
        )
        if debtor.credit_limit and existing_balance + credit_amount > debtor.credit_limit:
            raise ValueError("Credit limit exceeded")
    elif debtor_id is not None:
        raise ValueError("Debtor can only be supplied for a credit payment")

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

    for method, amount, payment_currency, reference in normalized_payments:
        Payment.objects.create(
            sale=sale,
            method=method,
            amount=amount,
            currency=payment_currency,
            reference=reference,
        )

    if credit_amount > 0:
        DebtorTransaction.objects.create(
            debtor=debtor,
            transaction_type=DebtorTransaction.Type.SALE,
            amount=credit_amount,
            currency=currency,
            sale=sale,
            reference=sale.receipt_number,
            created_by=cashier,
        )

    return sale

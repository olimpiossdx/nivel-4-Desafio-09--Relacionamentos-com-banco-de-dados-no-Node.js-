import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError("cliente não cadastrado");
    }

    const productExists = await this.productsRepository.findAllById(products);

    if (productExists.length === 0 || products.length !== productExists.length) {
      throw new AppError("um ou mais produtos não cadastrado");
    }

    const productInsufficientQuantities = products.filter(product => {
      return productExists.some(productExist => productExist.id === product.id && product.quantity > productExist.quantity);
    });

    if (productInsufficientQuantities.length > 0) {
      throw new AppError("um ou mais produtos com quantidade insuficiente");
    }

    const orderProducts = productExists.map(productExist =>
    ({
      product_id: productExist.id,
      quantity: products.filter(product => product.id == productExist.id)[0].quantity,
      price: productExist.price
    }))

    const newOrder = await this.ordersRepository.create({ customer, products: orderProducts });

    const productsUpdateQuantity = orderProducts.map(orderProduct => ({
      id: orderProduct.product_id,
      quantity: productExists.filter(productExist => productExist.id == orderProduct.product_id)[0].quantity - orderProduct.quantity
    }));

    await this.productsRepository.updateQuantity(productsUpdateQuantity)

    return newOrder;
  }
}

export default CreateOrderService;

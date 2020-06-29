import { getRepository, getCustomRepository } from 'typeorm';

import AppError from '../errors/AppError';
import TransactionRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionRepository);
    const categoriesRepository = getRepository(Category);

    const request = { title, value, type, category };

    Object.entries(request).forEach(([key, val]) => {
      if (!val) {
        throw Error(`${key} is required`);
      }

      if (key === 'value' && val < 0) {
        throw Error('value must be greater than zero');
      }

      if (key === 'type' && !['income', 'outcome'].includes(val.toString())) {
        throw new AppError('type value must be income or outcome', 400);
      }
    });

    if (type === 'outcome') {
      const balance = await transactionsRepository.getBalance();
      if (balance.total - value < 0) {
        throw new AppError('outcome value must be less than balance', 400);
      }
    }

    let categ = await categoriesRepository.findOne({
      where: { title: category },
    });

    if (!categ) {
      categ = categoriesRepository.create({
        title: category,
      });

      await categoriesRepository.save(categ);
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id: categ.id,
    });

    await transactionsRepository.save(transaction);

    transaction.category = categ;

    return transaction;
  }
}

export default CreateTransactionService;

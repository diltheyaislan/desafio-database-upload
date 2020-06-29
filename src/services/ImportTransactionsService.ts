/* eslint-disable no-await-in-loop */

import path from 'path';
import fs from 'fs';
import util from 'util';
import { getCustomRepository, getRepository } from 'typeorm';

import uploadConfig from '../config/upload';
import Transaction from '../models/Transaction';
import AppError from '../errors/AppError';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  csvFilename: string;
}

class ImportTransactionsService {
  async execute({ csvFilename }: Request): Promise<Transaction[]> {
    const csvFilePath = path.join(uploadConfig.directory, csvFilename);
    const csvFileExists = await fs.promises.stat(csvFilePath);

    if (!csvFileExists) {
      throw new AppError('File to import not found', 406);
    }

    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const transactions: Transaction[] = [];

    const readFile = util.promisify(fs.readFile);

    const contentFile = await readFile(csvFilePath, 'binary');

    const lines = contentFile.split('\n');

    // eslint-disable-next-line no-restricted-syntax
    for (const line of lines) {
      if (line && line.trim() && !line.startsWith('title,')) {
        const [title, type, value, category] = line.split(',');

        let categ = await categoriesRepository.findOne({
          where: { title: category.trim() },
        });

        if (!categ) {
          categ = categoriesRepository.create({
            title: category.trim(),
          });

          await categoriesRepository.save(categ);
        }

        const transaction = transactionsRepository.create({
          title: title.trim(),
          value: parseFloat(value),
          type: type.trim() === 'income' ? 'income' : 'outcome',
          category_id: categ.id,
        });

        await transactionsRepository.save(transaction);

        transaction.category = categ;

        transactions.push(transaction);
      }
    }

    await fs.promises.unlink(csvFilePath);

    return transactions;
  }
}

export default ImportTransactionsService;

package com.withesse.algorithm;

public class ArrayRotateExample {

    public static void rotate180(int[][] matrix) {
        int n = matrix.length;
        int m = matrix[0].length;

        for (int i = 0; i < n/2; i++) {
            for (int j = 0; j < m; j++) {
                int temp = matrix[i][j];
                matrix[i][j] = matrix[n - 1 - i][m - 1 - j];
                matrix[n - 1 - i][m - 1 - j] = temp;
            }
        }

//        if (n % 2 == 1) {
//            for (int j = 0; j < m/2; j++) {
//                int temp = matrix[n/2][j];
//                matrix[n/2][j] = matrix[n/2][m - 1 - j];
//                matrix[n/2][m - 1 - j] = temp;
//            }
//        }
    }
    public static void rotate90(int[][] matrix) {
        int n = matrix.length;

        // 首先，我们对矩阵进行转置。转置就是将矩阵的行变为列，列变为行。
        for (int i = 0; i < n; i++) {
            for (int j = i; j < n; j++) {
                int temp = matrix[j][i];
                matrix[j][i] = matrix[i][j];
                matrix[i][j] = temp;
            }
        }

        // 接着，我们对矩阵的每一行进行反转，就得到了原矩阵顺时针旋转90度的结果。
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n / 2; j++) {
                int temp = matrix[i][j];
                matrix[i][j] = matrix[i][n - j - 1];
                matrix[i][n - j - 1] = temp;
            }
        }
    }

    public static void main(String[] args) {
        int[][] matrix = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
        rotate90(matrix);

        for (int i = 0; i < matrix.length; i++) {
            for (int j = 0; j < matrix[0].length; j++) {
                System.out.print(matrix[i][j] + " ");
            }
            System.out.println();
        }
    }
//    public static void main(String[] args) {
//        int[][] matrix = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
//        rotate180(matrix);
//
//        for (int i = 0; i < matrix.length; i++) {
//            for (int j = 0; j < matrix[0].length; j++) {
//                System.out.print(matrix[i][j] + " ");
//            }
//            System.out.println();
//        }
//    }
}

